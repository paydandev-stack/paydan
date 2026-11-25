import "server-only";

import { randomUUID } from "node:crypto";
import type { AdminCapability } from "@/lib/capabilities";
import type { Queryable } from "./db";
import { put } from "./db";
import { enqueueOperationsAlert } from "./mail/queue";

type AuditInput = {
  actor: string;
  action: string;
  record: string;
  capability?: AdminCapability;
  source?: "admin" | "customer" | "worker" | "webhook" | "vendor";
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
  const sensitive = [
    "refund",
    "customers.anonymize",
    "customers.merge",
    "team",
    "VendorAccount",
    "services.verify",
    "settings",
  ].some((value) => input.action.toLowerCase().includes(value.toLowerCase()));
  if (sensitive)
    await enqueueOperationsAlert(db, {
      eventKey: `audit:${id}:sensitive`,
      eventType: "audit.sensitive",
      title: "Sensitive admin action recorded",
      message: `${input.actor} performed ${input.action} on ${input.record || "an unscoped record"}.`,
      href: `/admin/audit?record=${encodeURIComponent(input.record)}`,
    });
}
