import { queryCatalog } from "@/server/mobile-catalog";
import { failure, json, viewer } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    const url = new URL(request.url);
    const result = await queryCatalog(
      user,
      Object.fromEntries(url.searchParams),
    );
    return json(
      result,
      200,
      user
        ? { "Cache-Control": "private, no-store" }
        : {
            "Cache-Control":
              "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
            Vary: "Accept-Encoding",
          },
    );
  } catch (error) {
    return failure(error);
  }
}
