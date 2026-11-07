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
  Email: ["SMTP_HOST", "MAIL_FROM"],
  AI: ["AI_CHAT_COMPLETIONS_URL", "AI_API_KEY", "AI_MODEL"],
};
const optional: Record<string, string[]> = {
  Storage: ["S3_ENDPOINT", "S3_PUBLIC_ENDPOINT", "S3_FORCE_PATH_STYLE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
};
let missing = false;
for (const [group, keys] of Object.entries(groups)) {
  const absent = keys.filter((key) => !process.env[key]);
  console.log(
    `${group}: ${absent.length ? "missing " + absent.join(", ") : "configured (not connectivity-tested)"}`,
  );
  if (group !== "AI" && absent.length) missing = true;
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
process.exitCode = missing ? 1 : 0;
