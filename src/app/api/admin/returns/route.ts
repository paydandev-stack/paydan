import { z } from "zod";
import { database } from "@/server/db";
import {
  body,
  failure,
  json,
  requireCapability,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
import { refundReturn, verifyRefund } from "@/server/refunds";
export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    requireCapability(user, "returns.read");
    const url = new URL(request.url);
    const cursor = z
      .string()
      .datetime()
      .optional()
      .parse(url.searchParams.get("cursor") || undefined);
    const status = z
      .string()
      .trim()
      .max(40)
      .optional()
      .parse(url.searchParams.get("status") || undefined);
    const result = await database().query(
      `SELECT * FROM refund
       WHERE ($1::timestamptz IS NULL OR created_at < $1)
         AND ($2::text IS NULL OR status=$2)
       ORDER BY created_at DESC LIMIT 26`,
      [cursor ?? null, status ?? null],
    );
    const hasMore = result.rows.length > 25;
    const refunds = result.rows.slice(0, 25);
    return json({
      refunds,
      nextCursor: hasMore
        ? new Date(refunds.at(-1).created_at).toISOString()
        : null,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    requireCapability(user, "refunds.issue");
    const input = await body(request);
    if (input.action === "verify") {
      const id = z.string().max(100).parse(input.providerId);
      await verifyRefund(id);
      return json({ message: "Refund status refreshed." });
    }
    const parsed = z
      .object({
        returnId: z.string().uuid(),
        amountKobo: z.number().int().positive().optional(),
      })
      .parse(input);
    return json(await refundReturn(user, parsed.returnId, parsed.amountKobo));
  } catch (error) {
    return failure(error);
  }
}
