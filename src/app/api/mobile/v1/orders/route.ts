import { z } from "zod";
import { customerOrder } from "@/server/snapshot";
import { database } from "@/server/db";
import { scopedRecordKind } from "@/server/test-buyer";
import type { Order } from "@/lib/types";
import {
  mobileFailure,
  mobileJson,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

const querySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    return z.object({ offset: z.number().int().min(0) }).parse(parsed).offset;
  } catch {
    throw new Error("Invalid cursor.");
  }
}

const encodeCursor = (offset: number) =>
  Buffer.from(JSON.stringify({ offset })).toString("base64url");

/** GET /api/mobile/v1/orders — viewer order history, cursor-paginated. */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    const url = new URL(request.url);
    const input = querySchema.parse(Object.fromEntries(url.searchParams));
    const offset = decodeCursor(input.cursor);
    const db = database();
    const kind = scopedRecordKind(user, "orders");
    const result = await db.query(
      "SELECT data FROM commerce_record WHERE kind=$1 AND owner_id=$2 ORDER BY updated_at DESC OFFSET $3 LIMIT $4",
      [kind, user.id, offset, input.limit + 1],
    );
    const hasMore = result.rows.length > input.limit;
    const orders = result.rows
      .slice(0, input.limit)
      .map((row) => customerOrder(row.data as Order));
    return mobileJson({
      orders,
      nextCursor: hasMore ? encodeCursor(offset + input.limit) : null,
    });
  } catch (error) {
    return mobileFailure(error);
  }
}
