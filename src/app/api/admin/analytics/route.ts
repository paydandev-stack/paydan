import { database } from "@/server/db";
import { failure, json, requireCapability, viewer } from "@/server/http";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    requireCapability(await viewer(request.headers), "analytics.read");
    const url = new URL(request.url);
    const date = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional();
    const from = date.parse(url.searchParams.get("from") || undefined);
    const to = date.parse(url.searchParams.get("to") || undefined);
    const refunds = await database().query(
      `SELECT
        COALESCE(sum(amount_kobo) FILTER (WHERE status='processed'),0)::bigint AS processed_kobo,
        count(*) FILTER (WHERE status='processed')::int AS processed_count,
        count(*) FILTER (WHERE status NOT IN ('processed','failed'))::int AS pending_count
       FROM refund
       WHERE ($1::date IS NULL OR created_at >= $1::date)
         AND ($2::date IS NULL OR created_at < $2::date + interval '1 day')`,
      [from ?? null, to ?? null],
    );
    return json({
      processedRefunds: Number(refunds.rows[0].processed_kobo) / 100,
      processedRefundCount: refunds.rows[0].processed_count,
      pendingRefundCount: refunds.rows[0].pending_count,
    });
  } catch (error) {
    return failure(error);
  }
}
