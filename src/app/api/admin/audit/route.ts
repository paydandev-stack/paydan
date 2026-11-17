import { z } from "zod";
import { database } from "@/server/db";
import { failure, json, requireCapability, viewer } from "@/server/http";

export async function GET(request: Request) {
  try {
    requireCapability(await viewer(request.headers), "audit.read");
    const url = new URL(request.url);
    const cursor = z
      .string()
      .datetime()
      .optional()
      .parse(url.searchParams.get("cursor") || undefined);
    const action = z
      .string()
      .max(80)
      .optional()
      .parse(url.searchParams.get("action") || undefined);
    const format = z
      .enum(["json", "csv"])
      .default("json")
      .parse(url.searchParams.get("format") || undefined);
    const result = await database().query(
      `SELECT data,updated_at FROM commerce_record
       WHERE kind='audit'
         AND ($1::timestamptz IS NULL OR updated_at < $1)
         AND ($2::text IS NULL OR data->>'action' ILIKE '%' || $2 || '%')
       ORDER BY updated_at DESC LIMIT $3`,
      [cursor ?? null, action ?? null, format === "csv" ? 5000 : 51],
    );
    if (format === "csv") {
      const cell = (value: unknown) => {
        let text = value == null ? "" : String(value);
        if (/^[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
      };
      const rows = result.rows.map(({ data }) =>
        [
          data.at,
          data.actor,
          data.capability,
          data.action,
          data.record,
          data.source,
        ]
          .map(cell)
          .join(","),
      );
      return new Response(
        ["timestamp,actor,capability,action,record,source", ...rows].join(
          "\r\n",
        ),
        {
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="paydan-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    const hasMore = result.rows.length > 50;
    const rows = result.rows.slice(0, 50);
    return json({
      entries: rows.map((row) => row.data),
      nextCursor: hasMore
        ? new Date(rows.at(-1).updated_at).toISOString()
        : null,
    });
  } catch (error) {
    return failure(error);
  }
}
