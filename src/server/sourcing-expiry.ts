import "server-only";

import type { SourcingRequest } from "@/lib/types";
import { database, put, records } from "./db";
import { writeAudit } from "./audit";

/** Expires sent quotes after their validity window without touching closed work. */
export async function expireSourcingQuotes(now = new Date()) {
  const db = database();
  const requests = await records<SourcingRequest>(db, "sourcing");
  let expired = 0;
  for (const request of requests) {
    if (
      request.quote?.status !== "sent" ||
      !Number.isFinite(Date.parse(request.quote.validUntil)) ||
      Date.parse(request.quote.validUntil) >= now.getTime()
    )
      continue;
    const before = structuredClone(request.quote);
    request.quote.status = "expired";
    request.quote.respondedAt = now.toISOString();
    request.status = "quote_ready";
    await put(db, "sourcing", request.id, request, request.customerId ?? null);
    await writeAudit(db, {
      actor: "system",
      action: "sourcing.quote-expired",
      record: request.id,
      source: "worker",
      before,
      after: request.quote,
    });
    expired += 1;
  }
  return { scanned: requests.length, expired, completedAt: now.toISOString() };
}
