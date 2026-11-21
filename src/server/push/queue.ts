import "server-only";

import { randomUUID } from "node:crypto";
import type { Queryable } from "../db";

export type PushCategory =
  | "transactional"
  | "sourcing"
  | "support"
  | "marketing";

export type QueuePushInput = {
  ownerId: string;
  eventKey: string;
  title: string;
  body: string;
  /** Viewer-authorized deep-link path (e.g. /account/orders/123). */
  href: string;
  category?: PushCategory;
};

/**
 * Enqueue an Expo push send. Call from the same durable transaction that
 * writes the notification row so push and email/in-app stay consistent.
 * Transactional events always enqueue; non-essential categories respect
 * the user's opt-out. Never throws — push is best-effort next to email.
 */
export async function enqueuePush(
  db: Queryable,
  input: QueuePushInput,
): Promise<boolean> {
  const category = input.category ?? "transactional";
  try {
    if (category !== "transactional") {
      const optedOut = await db.query(
        "SELECT 1 FROM push_opt_out WHERE owner_id=$1 AND category=$2",
        [input.ownerId, category],
      );
      if (optedOut.rows.length) return false;
    }
    const result = await db.query(
      `INSERT INTO push_outbox(owner_id,event_key,title,body,href)
VALUES($1,$2,$3,$4,$5)
ON CONFLICT(owner_id,event_key) DO NOTHING RETURNING id`,
      [input.ownerId, input.eventKey, input.title, input.body, input.href],
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error(
      "[push] enqueue failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return false;
  }
}

/** Derive the href the app should deep-link to for a notification type. */
export function pushHrefFor(type: string, href: string): string {
  // Only allowlist viewer-authorized account paths; never admin routes.
  if (href.startsWith("/account/") || href.startsWith("/cart")) return href;
  if (type.startsWith("payment.") || type.startsWith("order."))
    return "/account/orders";
  if (type.startsWith("sourcing.")) return "/account/sourcing-requests";
  if (type.startsWith("support.")) return "/account";
  return "/account";
}

export function pushCategoryFor(eventType: string): PushCategory {
  if (
    eventType.startsWith("payment.") ||
    eventType.startsWith("order.") ||
    eventType.startsWith("refund.")
  )
    return "transactional";
  if (eventType.startsWith("sourcing.")) return "sourcing";
  if (eventType.startsWith("support.")) return "support";
  return "marketing";
}

export { randomUUID };
