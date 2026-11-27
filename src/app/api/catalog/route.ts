import { publicCatalogSnapshot } from "@/server/public-catalog";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await publicCatalogSnapshot(), {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=0, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
