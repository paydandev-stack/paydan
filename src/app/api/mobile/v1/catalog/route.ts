import {
  mobileFailure,
  mobilePublicJson,
  mobileViewer,
} from "@/server/mobile-http";
import { queryCatalog } from "@/server/mobile-catalog";

export const runtime = "nodejs";

/**
 * GET /api/mobile/v1/catalog
 * Paginated viewer-scoped catalogue. Guests receive price-free DTOs and
 * cannot sort/filter by price. Public cacheable for guests only.
 */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    const url = new URL(request.url);
    const result = await queryCatalog(
      user,
      Object.fromEntries(url.searchParams),
    );
    return mobilePublicJson(
      result,
      200,
      user ? { "Cache-Control": "private, no-store" } : undefined,
    );
  } catch (error) {
    return mobileFailure(error);
  }
}
