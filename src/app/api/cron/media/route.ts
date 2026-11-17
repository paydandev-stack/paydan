import { cleanupOrphanedCatalogMedia } from "@/server/media";
import { runRecordedWorker } from "@/server/workers";
import { failure, json } from "@/server/http";

export async function GET(request: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    if (
      !expected ||
      request.headers.get("authorization") !== `Bearer ${expected}`
    )
      return json({ error: "Unauthorized" }, 401);
    return json(
      await runRecordedWorker("media", () => cleanupOrphanedCatalogMedia(100)),
    );
  } catch (error) {
    return failure(error);
  }
}
