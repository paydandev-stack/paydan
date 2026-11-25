import { database } from "@/server/db";
import {
  failure,
  json,
  limit,
  requireAnyCapability,
  viewer,
} from "@/server/http";
import { catalogCdnUrl } from "@/server/media-delivery";

export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    requireAnyCapability(user, ["catalog.read", "catalog.write"]);
    await limit("media-library:" + user!.id, 120);
    const result = await database().query(
      "SELECT id,object_key,purpose,mime,created_at FROM media WHERE status='ready' AND purpose='catalog' ORDER BY created_at DESC LIMIT 200",
    );
    const failed = await database().query(
      "SELECT count(*)::int AS count FROM media WHERE status<>'ready' AND created_at > now() - interval '24 hours'",
    );
    return json({
      failedUploads: failed.rows[0]?.count ?? 0,
      media: result.rows.map((row) => ({
        id: row.id,
        objectKey: row.object_key,
        purpose: row.purpose,
        mime: row.mime,
        createdAt: new Date(row.created_at).toISOString(),
        url: catalogCdnUrl(row.object_key) || "/api/media/" + row.id,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
