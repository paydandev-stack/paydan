import "server-only";

import { randomUUID } from "node:crypto";
import type { AdminCapability } from "@/lib/capabilities";
import type { Queryable } from "./db";
import { put } from "./db";

type AuditInput = {
  actor: string;
  action: string;
  record: string;
  capability?: AdminCapability;
  source?: "admin" | "customer" | "worker" | "webhook";
  before?: unknown;
  after?: unknown;
};

function sanitized(value: unknown) {
  if (value === undefined) return undefined;
  const serialized = JSON.stringify(value);
  if (serialized.length <= 4000) return value;
  return { summary: "Change detail exceeded the audit size limit." };
}

export async function writeAudit(db: Queryable, input: AuditInput) {
  const id = randomUUID();
  await put(db, "audit", id, {
    id,
    actor: input.actor,
    action: input.action,
    record: input.record,
    capability: input.capability,
    source: input.source ?? "admin",
    before: sanitized(input.before),
    after: sanitized(input.after),
    at: new Date().toISOString(),
  });
}
