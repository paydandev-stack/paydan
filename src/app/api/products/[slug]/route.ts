import { productDetail } from "@/server/mobile-catalog";
import { failure, json, viewer } from "@/server/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await viewer(request.headers);
    const result = await productDetail(user, (await context.params).slug);
    return json(
      result,
      200,
      user
        ? undefined
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
