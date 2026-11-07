import { snapshot } from "@/server/snapshot";
import { viewer, json, failure } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return json(
      await snapshot(
        await viewer(request.headers),
        new URL(request.url).searchParams.get("scope") === "admin",
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
