import "server-only";

import { randomUUID } from "node:crypto";
import { database } from "../db";

type ClaimedPush = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  href: string;
  attempts: number;
  claim_token: string;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function claim(limit: number): Promise<ClaimedPush[]> {
  const token = randomUUID();
  const result = await database().query(
    `WITH due AS (
SELECT id FROM push_outbox
WHERE sent_at IS NULL AND dead_at IS NULL AND attempts < 8 AND next_attempt <= now()
AND (claimed_at IS NULL OR claimed_at < now() - interval '10 minutes')
ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1
)
UPDATE push_outbox m SET claimed_at=now(),claim_token=$2 FROM due
WHERE m.id=due.id RETURNING m.*`,
    [Math.max(1, Math.min(limit, 50)), token],
  );
  return result.rows;
}

function backoff(attempts: number): string {
  const seconds = Math.min(3600, 60 * 2 ** Math.min(attempts, 5));
  return `${seconds} seconds`;
}

async function markSent(id: string, token: string) {
  await database().query(
    "UPDATE push_outbox SET sent_at=now(),claimed_at=NULL,claim_token=NULL WHERE id=$1 AND claim_token=$2",
    [id, token],
  );
}

async function markRetry(id: string, token: string, error: string) {
  await database().query(
    `UPDATE push_outbox SET attempts=attempts+1,last_error=$3,next_attempt=now()+($4::interval),claimed_at=NULL,claim_token=NULL,
dead_at=CASE WHEN attempts+1 >= 8 THEN now() ELSE NULL END WHERE id=$1 AND claim_token=$2`,
    [id, token, error.slice(0, 500), backoff(1)],
  );
}

async function removeToken(ownerId: string, token: string) {
  await database().query(
    "DELETE FROM push_token WHERE owner_id=$1 AND token=$2",
    [ownerId, token],
  );
}

function headers(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN)
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  return headers;
}

/**
 * Send one push_outbox batch via the Expo Push API.
 * - Per owner: all registered (device, environment) tokens, production
 *   preferred but all environments attempted (dev builds get dev pushes).
 * - `DeviceNotRegistered` receipts delete the token; other errors retry
 *   with bounded backoff (8 attempts, then dead).
 * - href is viewer-authorized by construction (pushHrefFor allowlist).
 */
export async function processPushBatch(limit = 50) {
  const items = await claim(limit);
  if (!items.length) return { claimed: 0, sent: 0, failed: 0, pruned: 0 };
  let sent = 0;
  let failed = 0;
  let pruned = 0;
  for (const item of items) {
    try {
      const tokens = await database().query(
        "SELECT token FROM push_token WHERE owner_id=$1",
        [item.owner_id],
      );
      if (!tokens.rows.length) {
        await markSent(item.id, item.claim_token);
        sent++;
        continue;
      }
      const messages = tokens.rows.map((row: { token: string }) => ({
        to: row.token,
        title: item.title,
        body: item.body,
        data: { href: item.href },
        sound: "default",
      }));
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(20000),
      });
      const payload = (await response.json()) as {
        data?: ExpoTicket[];
        errors?: Array<{ message?: string }>;
      };
      if (!response.ok || payload.errors) {
        const message =
          payload.errors?.map((e) => e.message ?? "error").join("; ") ||
          `Expo push rejected (${response.status})`;
        await markRetry(item.id, item.claim_token, message);
        failed++;
        continue;
      }
      const tickets = payload.data ?? [];
      let itemOk = true;
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = tokens.rows[i]?.token as string | undefined;
        if (ticket?.status === "error") {
          if (ticket.details?.error === "DeviceNotRegistered" && token) {
            await removeToken(item.owner_id, token);
            pruned++;
          } else {
            itemOk = false;
          }
        }
      }
      if (itemOk) {
        await markSent(item.id, item.claim_token);
        sent++;
      } else {
        await markRetry(item.id, item.claim_token, "Expo ticket error");
        failed++;
      }
    } catch (error) {
      await markRetry(
        item.id,
        item.claim_token,
        error instanceof Error ? error.message : "Unknown push error",
      );
      failed++;
    }
  }
  return { claimed: items.length, sent, failed, pruned };
}
