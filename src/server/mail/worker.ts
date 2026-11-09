import "server-only";

import { randomUUID } from "node:crypto";
import { database } from "../db";
import { mailTransport, messageDomain } from "./transport";

type ClaimedMail = { id: string; recipient: string; subject: string; body: string; html: string | null; reply_to: string | null; attempts: number; claim_token: string };

async function claim(limit: number): Promise<ClaimedMail[]> {
  const token = randomUUID();
  const result = await database().query(
    `WITH due AS (
      SELECT id FROM mail_outbox
      WHERE sent_at IS NULL AND dead_at IS NULL AND attempts < 8 AND next_attempt <= now()
        AND (claimed_at IS NULL OR claimed_at < now() - interval '10 minutes')
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE mail_outbox m SET claimed_at=now(),claim_token=$2 FROM due
    WHERE m.id=due.id RETURNING m.*`,
    [Math.max(1, Math.min(limit, 50)), token],
  );
  return result.rows;
}

export async function processMailBatch(limit = 25) {
  const mails = await claim(limit);
  if (!mails.length) return { claimed: 0, sent: 0, failed: 0, suppressed: 0 };
  const transport = mailTransport();
  let sent = 0, failed = 0, suppressed = 0;
  for (const mail of mails) {
    const blocked = await database().query("SELECT 1 FROM email_suppression WHERE recipient=$1", [mail.recipient.toLowerCase()]);
    if (blocked.rows.length) {
      await database().query("UPDATE mail_outbox SET dead_at=now(),last_error='Recipient suppressed',claimed_at=NULL,claim_token=NULL WHERE id=$1 AND claim_token=$2", [mail.id, mail.claim_token]);
      suppressed++;
      continue;
    }
    try {
      const info = await transport.sendMail({
        from: process.env.MAIL_FROM,
        to: mail.recipient,
        replyTo: mail.reply_to || process.env.MAIL_REPLY_TO || undefined,
        subject: mail.subject,
        text: mail.body,
        html: mail.html || undefined,
        messageId: `<${mail.id}@${messageDomain()}>`,
        headers: { "X-PAYDAN-Outbox-ID": mail.id },
      });
      const providerMessageId =
        info.response?.match(/\b([a-f0-9]{8}-[a-f0-9-]{27,})\b/i)?.[1] ||
        info.messageId ||
        null;
      await database().query(`UPDATE mail_outbox SET sent_at=now(),last_error=NULL,body='',html=NULL,provider_message_id=$3,claimed_at=NULL,claim_token=NULL WHERE id=$1 AND claim_token=$2`, [mail.id, mail.claim_token, providerMessageId]);
      sent++;
    } catch {
      await database().query(`UPDATE mail_outbox SET attempts=attempts+1,last_error='SMTP delivery failed',next_attempt=now()+(power(2,attempts+1)*interval '1 minute'),dead_at=CASE WHEN attempts+1 >= 8 THEN now() ELSE dead_at END,claimed_at=NULL,claim_token=NULL WHERE id=$1 AND claim_token=$2`, [mail.id, mail.claim_token]);
      failed++;
    }
  }
  return { claimed: mails.length, sent, failed, suppressed };
}
