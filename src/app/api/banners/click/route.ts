import { z } from "zod";
import { body, failure, json, sameOrigin } from "@/server/http";
import { database } from "@/server/db";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { bannerId } = z
      .object({ bannerId: z.string().min(1).max(150) })
      .parse(await body(request));
    await database().query(
      `UPDATE commerce_record
       SET data=jsonb_set(
         data,
         '{clickCount}',
         to_jsonb(COALESCE((data->>'clickCount')::int,0)+1),
         true
       ), updated_at=now()
       WHERE kind='banners' AND id=$1`,
      [bannerId],
    );
    return json({ recorded: true });
  } catch (error) {
    return failure(error);
  }
}
