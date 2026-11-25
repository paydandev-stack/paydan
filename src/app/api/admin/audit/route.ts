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
    const filter = z.string().trim().max(150).optional();
    const action = filter.parse(url.searchParams.get("action") || undefined);
    const actor = filter.parse(url.searchParams.get("actor") || undefined);
    const capability = filter.parse(
      url.searchParams.get("capability") || undefined,
    );
    const source = filter.parse(url.searchParams.get("source") || undefined);
    const record = filter.parse(url.searchParams.get("record") || undefined);
    const date = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional();
    const from = date.parse(url.searchParams.get("from") || undefined);
    const to = date.parse(url.searchParams.get("to") || undefined);
    const format = z
      .enum(["json", "csv"])
      .default("json")
      .parse(url.searchParams.get("format") || undefined);
    const result = await database().query(
      `SELECT data,updated_at FROM commerce_record
       WHERE kind='audit'
         AND ($1::timestamptz IS NULL OR updated_at < $1)
         AND ($2::text IS NULL OR data->>'action' ILIKE '%' || $2 || '%')
         AND ($3::text IS NULL OR data->>'actor' ILIKE '%' || $3 || '%')
         AND ($4::text IS NULL OR data->>'capability'=$4)
         AND ($5::text IS NULL OR data->>'source'=$5)
         AND ($6::text IS NULL OR data->>'record'=$6)
         AND ($7::date IS NULL OR updated_at >= $7::date)
         AND ($8::date IS NULL OR updated_at < $8::date + interval '1 day')
       ORDER BY updated_at DESC LIMIT $9`,
      [
        cursor ?? null,
        action ?? null,
        actor ?? null,
        capability ?? null,
        source ?? null,
        record ?? null,
        from ?? null,
        to ?? null,
        format === "csv" ? 50000 : 51,
      ],
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
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              "timestamp,actor,capability,action,record,source\r\n",
            ),
          );
          for (const row of rows)
            controller.enqueue(encoder.encode(row + "\r\n"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="paydan-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
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
