import { betterAuth, type BetterAuthOptions } from "better-auth";
import { database } from "./db";
import { createHash } from "node:crypto";
import { enqueueSystemMail } from "./mail/queue";
import { trustedOrigins } from "./origins";

export async function enqueueMail(
  recipient: string,
  subject: string,
  body: string,
) {
  const isReset = subject.toLowerCase().includes("reset");
  const url = body.match(/https?:\/\/\S+/)?.[0] || "";
  const digest = createHash("sha256").update(url || body).digest("hex");
  await enqueueSystemMail({
    eventKey: `auth:${isReset ? "reset" : "verify"}:${digest}`,
    eventType: isReset ? "auth.password_reset" : "auth.email_verification",
    recipient,
    template: isReset ? "auth.reset" : "auth.verify",
    data: { url },
  });
}
let instance: ReturnType<typeof betterAuth> | undefined;
export function auth() {
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32 ||
    !process.env.BETTER_AUTH_URL
  )
    throw new Error("Authentication is not configured.");
  const options: BetterAuthOptions = {
    database: database(),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: trustedOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) =>
        enqueueMail(
          user.email,
          "Reset your PAYDAN password",
          `Use this link to reset your password: ${url}`,
        ),
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        enqueueMail(
          user.email,
          "Verify your PAYDAN email",
          `Confirm your email address: ${url}`,
        ),
    },
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    account: {
      accountLinking: { enabled: true, disableImplicitLinking: true },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 20 },
  };
  return (instance ??= betterAuth(options));
}
