import { database } from "@/server/db";
import { mobileFailure, mobilePublicJson, mobileViewer } from "@/server/mobile-http";

export const runtime = "nodejs";

/**
 * GET /api/mobile/v1/bootstrap
 * Feature flags, app configuration, and the current viewer summary.
 * Guest-safe: never includes prices, carts, or account data.
 */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    return mobilePublicJson(
      {
        viewer: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              pricesVisible: true,
            }
          : { anonymous: true, pricesVisible: false },
        config: {
          minSupportedBuild: {
            android: Number(process.env.MOBILE_MIN_BUILD_ANDROID || 1),
            ios: Number(process.env.MOBILE_MIN_BUILD_IOS || 1),
          },
          paystackEnabled: Boolean(process.env.PAYSTACK_SECRET_KEY),
          googleSignInEnabled: Boolean(
            process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
          ),
          supportEmail:
            process.env.SUPPORT_EMAIL || "support@paydan.store",
        },
        flags: {
          assistantEnabled: true,
          sourcingEnabled: true,
          wishlistEnabled: true,
        },
      },
      200,
      user ? { "Cache-Control": "private, no-store" } : undefined,
    );
  } catch (error) {
    return mobileFailure(error);
  }
}
