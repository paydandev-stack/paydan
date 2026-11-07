import { betterAuth, type BetterAuthOptions } from "better-auth";
import { database } from "./db";
import { randomUUID } from "node:crypto";

export async function enqueueMail(
  recipient: string,
  subject: string,
  body: string,
) {
  await database().query(
    "INSERT INTO mail_outbox(id,recipient,subject,body) VALUES($1,$2,$3,$4)",
    [randomUUID(), recipient, subject, body],
  );
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
    trustedOrigins: [process.env.BETTER_AUTH_URL],
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
