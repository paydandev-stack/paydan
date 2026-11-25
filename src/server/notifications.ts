import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { Notification } from "@/lib/types";
import { put, records, type Queryable } from "./db";
import { isTestBuyer } from "./test-buyer";
import { enqueuePush, pushCategoryFor, pushHrefFor } from "./push/queue";

export async function enqueueNotification(
  db: Queryable,
  input: {
    ownerId: string;
    eventKey: string;
    type: string;
    title: string;
    body: string;
    href: string;
  },
) {
  const result = await db.query(
    `INSERT INTO notification(id,owner_id,type,title,body,href,source_event_key)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(owner_id,source_event_key) DO NOTHING`,
    [
      randomUUID(),
      input.ownerId,
      input.type,
      input.title,
      input.body,
      input.href,
      input.eventKey,
    ],
  );
  const inserted = (result.rowCount ?? 0) > 0;
  // Fan out to Expo push from the same durable event (same transaction).
  // Push is best-effort: failures never roll back the notification row.
  if (inserted)
    await enqueuePush(db, {
      ownerId: input.ownerId,
      eventKey: `push:${input.eventKey}`,
      title: input.title,
      body: input.body,
      href: pushHrefFor(input.type, input.href),
      category: pushCategoryFor(input.type),
    });
  return inserted;
}

export async function notificationsFor(
  db: Queryable,
  ownerId: string,
  limit = 50,
): Promise<Notification[]> {
  const result = await db.query(
    `SELECT id,type,title,body,href,created_at,read_at
     FROM notification WHERE owner_id=$1
     ORDER BY created_at DESC LIMIT $2`,
    [ownerId, Math.max(1, Math.min(limit, 100))],
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: new Date(row.created_at).toISOString(),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : undefined,
  }));
}

function eventNotificationId(ownerId: string, eventKey: string) {
  const digest = createHash("sha256")
    .update(`${ownerId}:${eventKey}`)
    .digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export async function enqueueViewerNotification(
  db: Queryable,
  user: { id: string; email: string },
  input: Omit<Parameters<typeof enqueueNotification>[1], "ownerId">,
) {
  if (!isTestBuyer(user))
    return enqueueNotification(db, { ...input, ownerId: user.id });
  const notification: Notification = {
    id: eventNotificationId(user.id, input.eventKey),
    type: input.type,
    title: `[Demonstration] ${input.title}`,
    body: input.body,
    href: input.href,
    createdAt: new Date().toISOString(),
  };
  await put(db, "testNotifications", notification.id, notification, user.id);
  return true;
}

export function testNotificationsFor(db: Queryable, ownerId: string) {
  return records<Notification>(db, "testNotifications", ownerId);
}
