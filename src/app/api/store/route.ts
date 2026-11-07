import { snapshot } from "@/server/snapshot";
import { viewer, json, failure } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    const admin = new URL(request.url).searchParams.get("scope") === "admin";
    // Anonymous storefronts fetch the separately cacheable, price-free payload.
    // The personalized endpoint remains private and never enters a shared cache.
    if (!user && !admin) return json({ guest: true });
    return json(await snapshot(user, admin));
  } catch (error) {
    return failure(error);
  }
}
