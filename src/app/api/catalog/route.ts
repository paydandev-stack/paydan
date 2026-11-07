import { publicCatalogSnapshot } from "@/server/public-catalog";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await publicCatalogSnapshot(), {
    headers: {
      "Cache-Control":
        "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
