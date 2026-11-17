import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { database, put, record } from "@/server/db";
import {
  body,
  failure,
  json,
  requireCapability,
  sameOrigin,
  viewer,
} from "@/server/http";
import { mailTransport } from "@/server/mail/transport";
import { paystack } from "@/server/payments";
import { signedCloudFrontUrl } from "@/server/cloudfront";
import { z } from "zod";
import { writeAudit } from "@/server/audit";

type HealthState =
  "not_configured" | "configured" | "verified" | "degraded" | "failing";
type Health = {
  status: HealthState;
  checkedAt?: string;
  mode?: string;
  message?: string;
};
type ServiceHealth = Record<string, Health>;

function configured(): ServiceHealth {
  const paystackMode = process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")
    ? "live"
    : process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")
      ? "test"
      : undefined;
  return {
    database: {
      status: process.env.DATABASE_URL ? "configured" : "not_configured",
    },
    google: {
      status:
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
          ? "configured"
          : "not_configured",
    },
    paystack: {
      status: paystackMode ? "configured" : "not_configured",
      mode: paystackMode,
    },
    storage: {
      status:
        process.env.AWS_REGION && process.env.S3_BUCKET
          ? "configured"
          : "not_configured",
    },
    cloudfront: {
      status:
        process.env.MEDIA_CDN_URL || process.env.CLOUDFRONT_DOMAIN
          ? "configured"
          : "not_configured",
    },
    email: {
      status:
        process.env.SMTP_HOST && process.env.MAIL_FROM
          ? "configured"
          : "not_configured",
    },
    ai: {
      status:
        process.env.AI_PRIMARY_MODEL || process.env.GROQ_API_KEY
          ? "configured"
          : "not_configured",
      message:
        "Use the assistant test flow to verify without accidental spend.",
    },
  };
}

async function verifyServices() {
  const next = configured();
  const checkedAt = new Date().toISOString();
  async function check(name: string, task: () => Promise<unknown>) {
    if (next[name].status === "not_configured") return;
    try {
      await task();
      next[name] = { ...next[name], status: "verified", checkedAt };
    } catch (error) {
      next[name] = {
        ...next[name],
        status: "failing",
        checkedAt,
        message: error instanceof Error ? error.name : "Connection failed",
      };
    }
  }
  await Promise.all([
    check("database", () => database().query("SELECT 1")),
    check("email", () => mailTransport().verify()),
    check("storage", async () => {
      const client = new S3Client({
        region: process.env.AWS_REGION,
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        credentials:
          process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              }
            : undefined,
      });
      await client.send(
        new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }),
      );
    }),
    check("paystack", () => paystack("/bank?country=nigeria&perPage=1")),
    check("cloudfront", async () => {
      const url = process.env.CLOUDFRONT_KEY_PAIR_ID
        ? signedCloudFrontUrl("health-check.webp")
        : process.env.MEDIA_CDN_URL || process.env.CLOUDFRONT_DOMAIN;
      if (!url) throw new Error("CloudFrontNotConfigured");
      new URL(url.startsWith("http") ? url : `https://${url}`);
    }),
  ]);
  if (next.google.status === "configured")
    next.google = {
      ...next.google,
      message: "Configured; verify with a complete Google sign-in flow.",
    };
  await put(database(), "systemState", "service-health", next);
  return next;
}

export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    requireCapability(user, "services.read");
    const cached = await record<ServiceHealth>(
      database(),
      "systemState",
      "service-health",
    );
    const current = configured();
    for (const [name, last] of Object.entries(cached ?? {})) {
      if (!current[name] || current[name].status === "not_configured") continue;
      current[name] = { ...current[name], ...last };
      if (
        last.status === "verified" &&
        last.checkedAt &&
        Date.now() - Date.parse(last.checkedAt) > 24 * 60 * 60 * 1000
      )
        current[name] = {
          ...current[name],
          status: "degraded",
          message: "The last successful check is more than 24 hours old.",
        };
    }
    return json(current);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireCapability(user, "services.read");
    z.object({ action: z.literal("verify") }).parse(await body(request));
    const result = await verifyServices();
    await writeAudit(database(), {
      actor: user!.email,
      action: "services.verify",
      record: "connected-services",
      capability: "services.read",
      source: "admin",
      after: Object.fromEntries(
        Object.entries(result).map(([name, health]) => [name, health.status]),
      ),
    });
    return json(result);
  } catch (error) {
    return failure(error);
  }
}
