import { expireSourcingQuotes } from "@/server/sourcing-expiry";
import { failure, json } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    if (
      !expected ||
      request.headers.get("authorization") !== `Bearer ${expected}`
    )
      return json({ error: "Unauthorized" }, 401);
    return json(await expireSourcingQuotes());
  } catch (error) {
    return failure(error);
  }
}

export const POST = GET;
