import "server-only";

import { z } from "zod";
import { auth } from "./auth";
import { database, put } from "./db";
import { HttpError, type Viewer } from "./http";
import { isTestBuyer } from "./test-buyer";
import {
  mobileErrorSchema,
  toMobileError,
  type MobileError,
} from "@/mobile-contract/errors";

/**
 * Mobile API plumbing for /api/mobile/v1.
 *
 * Native clients authenticate with the Better Auth session (cookie or
 * `Authorization: Bearer <session-token>` via the bearer plugin) rather
 * than a web Origin header, so `sameOrigin()` is intentionally NOT applied
 * here. Every route still validates authentication, ownership, prices,
 * inventory, totals, delivery and permissions on the server.
 */

type MobileSession = {
  user: { id: string; name: string; email: string; emailVerified: boolean };
} | null;

export function mobileJson(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function mobilePublicJson(
  data: unknown,
  status = 200,
  headers?: HeadersInit,
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control":
        "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      Vary: "Accept-Encoding, Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function mobileFailure(error: unknown) {
  if (error instanceof HttpError) {
    const mapped = toMobileError(error.status, error.message);
    return mobileJson(mobileErrorSchema.parse(mapped), error.status);
  }
  if (error instanceof z.ZodError) {
    const mapped: MobileError = {
      code: "validation",
      message: error.issues.map((i) => i.message).join("; "),
    };
    return mobileJson(mobileErrorSchema.parse(mapped), 400);
  }
  console.error(
    "PAYDAN mobile request failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  const mapped: MobileError = {
    code: "service_unavailable",
    message: "This service is temporarily unavailable. Please try again later.",
  };
  return mobileJson(mobileErrorSchema.parse(mapped), 503);
}

/** Resolve the viewer from cookie session or Bearer session token. */
export async function mobileViewer(request: Request): Promise<Viewer | null> {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  const headers = new Headers(request.headers);
  let session: MobileSession = null;
  try {
    const raw: unknown = await (
      auth().api as unknown as {
        getSession: (input: { headers: Headers }) => Promise<unknown>;
      }
    ).getSession({ headers });
    const parsed = z
      .object({
        user: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          emailVerified: z.boolean(),
        }),
      })
      .safeParse(raw);
    if (parsed.success) session = parsed.data;
    else session = null;
  } catch {
    return null;
  }
  if (!session || !session.user.emailVerified) return null;
  const db = database();
  await db.query(
    "INSERT INTO commerce_record(kind,id,owner_id,data) VALUES('customers',$1,$1,$2) ON CONFLICT(kind,id) DO NOTHING",
    [
      session.user.id,
      JSON.stringify({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        phone: "",
        city: "",
        state: "",
        joinedAt: new Date().toISOString(),
        segments: [],
        tags: [],
        marketingConsent: false,
        notes: "",
      }),
    ],
  );
  const team = await db.query(
    "SELECT data FROM commerce_record WHERE kind='team'",
  );
  const teamMembers = team.rows.map((row) => row.data) as Array<{
    id: string;
    email: string;
    status: string;
    role: Viewer["role"];
    vendorId?: string;
  }>;
  const email = session.user.email.toLowerCase();
  let member = teamMembers.find(
    (m) => m.email.toLowerCase() === email && m.status === "active",
  );
  if (!member) {
    const invited = teamMembers.find(
      (item) =>
        item.email.toLowerCase() === email &&
        item.status === "invited" &&
        (item.role !== "Vendor" || Boolean(item.vendorId)),
    );
    if (invited) {
      member = { ...invited, status: "active" };
      await put(db, "team", member.id, {
        ...member,
        lastActive: new Date().toISOString(),
      });
    }
  }
  const result: Viewer = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: member?.role,
    teamMemberId: member?.id,
    vendorId: member?.vendorId,
  };
  const { ensureTestBuyerData } = await import("./test-buyer");
  await ensureTestBuyerData(result);
  return result;
}

export function requireMobileUser(user: Viewer | null): asserts user is Viewer {
  if (!user)
    throw new HttpError(401, "Sign in with a verified account to continue.");
}

/** Guests may browse; priced sorts/filters require a signed-in viewer. */
export function guestPriceGuard(user: Viewer | null, priced: boolean) {
  if (!user && priced)
    throw new HttpError(403, "Sign in to use priced search and sorting.");
}

export function isTestScope(user: Viewer) {
  return isTestBuyer(user);
}

export async function mobileBody(request: Request) {
  const text = await request.text();
  if (text.length > 100_000) throw new HttpError(413, "Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}

export async function mobileLimit(key: string, max = 60, seconds = 60) {
  const { limit } = await import("./http");
  return limit(key, max, seconds);
}
