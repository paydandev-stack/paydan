import { failure, json, requireRole, viewer } from "@/server/http";
export async function GET(request: Request) {
  try {
    requireRole(await viewer(request.headers), []);
    return json({
      database: !!process.env.DATABASE_URL,
      google: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
      paystack: process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")
        ? "live"
        : process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")
          ? "test"
          : "not configured",
      storage: !!(process.env.AWS_REGION && process.env.S3_BUCKET),
      email: !!(process.env.SMTP_HOST && process.env.MAIL_FROM),
      ai:
        (process.env.AI_PROVIDER_PROFILE ||
          (process.env.NODE_ENV === "production" ? "production" : "test")) ===
        "production"
          ? !!(process.env.AI_PRIMARY_MODEL && process.env.AI_SECONDARY_MODEL)
          : !!process.env.GROQ_API_KEY,
    });
  } catch (error) {
    return failure(error);
  }
}
