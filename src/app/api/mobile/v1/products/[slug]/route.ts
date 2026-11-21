import {
  mobileFailure,
  mobilePublicJson,
  mobileViewer,
} from "@/server/mobile-http";
import { productDetail } from "@/server/mobile-catalog";

export const runtime = "nodejs";

/** GET /api/mobile/v1/products/:slug — viewer-scoped detail + related. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await mobileViewer(request);
    const result = await productDetail(user, (await context.params).slug);
    return mobilePublicJson(
      result,
      200,
      user ? { "Cache-Control": "private, no-store" } : undefined,
    );
  } catch (error) {
    return mobileFailure(error);
  }
}
