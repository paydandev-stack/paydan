import { failure, json } from "@/server/http";
import { publishScheduledProducts } from "@/server/product-scheduling";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    if (
      !expected ||
      request.headers.get("authorization") !== "Bearer " + expected
    )
      return json({ error: "Unauthorized" }, 401);
    return json(await publishScheduledProducts());
  } catch (error) {
    return failure(error);
  }
}
