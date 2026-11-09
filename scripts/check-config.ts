import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
const groups: Record<string, string[]> = {
  Database: ["DATABASE_URL"],
  Authentication: [
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ],
  Payments: ["PAYSTACK_SECRET_KEY"],
  Storage: ["AWS_REGION", "S3_BUCKET"],
  "Private media delivery": [
    "MEDIA_CDN_URL",
    "CLOUDFRONT_KEY_PAIR_ID",
    "CLOUDFRONT_PRIVATE_KEY_BASE64",
  ],
  Email: [
    "SMTP_HOST",
    "MAIL_FROM",
    "MAIL_REPLY_TO",
    "OPERATIONS_NOTIFICATION_EMAIL",
    "RESEND_WEBHOOK_SECRET",
    "CRON_SECRET",
  ],
  AI: ["AI_PROVIDER_PROFILE", "AI_PRIMARY_MODEL", "AI_SECONDARY_MODEL"],
};
const optional: Record<string, string[]> = {
  Authentication: ["BETTER_AUTH_TRUSTED_ORIGINS"],
  Storage: ["S3_ENDPOINT", "S3_PUBLIC_ENDPOINT", "S3_FORCE_PATH_STYLE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
  AI: ["AI_GATEWAY_API_KEY", "GROQ_API_KEY", "GROQ_MODEL"],
};
let missing = false;
for (const [group, keys] of Object.entries(groups)) {
  const absent = keys.filter((key) => !process.env[key]);
  console.log(
    `${group}: ${absent.length ? "missing " + absent.join(", ") : "configured (not connectivity-tested)"}`,
  );
  if (absent.length) missing = true;
}
if (
  process.env.BETTER_AUTH_SECRET &&
  process.env.BETTER_AUTH_SECRET.length < 32
) {
  console.log(
    "Authentication: secret must have at least 32 random characters.",
  );
  missing = true;
}
if (
  process.env.CLOUDFRONT_PRIVATE_KEY_BASE64 &&
  !Buffer.from(process.env.CLOUDFRONT_PRIVATE_KEY_BASE64, "base64")
    .toString("utf8")
    .includes("PRIVATE KEY")
) {
  console.log("Private media delivery: CLOUDFRONT_PRIVATE_KEY_BASE64 must decode to a PEM private key.");
  missing = true;
}
process.exitCode = missing ? 1 : 0;
