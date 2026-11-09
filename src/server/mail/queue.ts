import "server-only";

import { randomUUID } from "node:crypto";
import { database, type Queryable } from "../db";
import { renderMail, type MailTemplateKey, type TemplateData } from "./templates";

export type QueueMailInput = {
  eventKey: string;
  eventType: string;
  recipient: string;
  audience?: "customer" | "operations";
  template: MailTemplateKey;
  data: TemplateData;
  replyTo?: string;
};

export async function enqueueMail(db: Queryable, input: QueueMailInput): Promise<boolean> {
  const rendered = renderMail(input.template, input.data);
  const result = await db.query(
    `INSERT INTO mail_outbox(id,recipient,subject,body,event_key,event_type,audience,template_key,template_data,html,reply_to)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT(event_key) WHERE event_key IS NOT NULL DO NOTHING RETURNING id`,
    [randomUUID(), input.recipient.toLowerCase(), rendered.subject, rendered.text, input.eventKey, input.eventType, input.audience || "customer", input.template, JSON.stringify(input.data), rendered.html, input.replyTo || process.env.MAIL_REPLY_TO || null],
  );
  return result.rows.length > 0;
}

export async function enqueueSystemMail(input: QueueMailInput) {
  return enqueueMail(database(), input);
}

function operationsRecipients(): string[] {
  return (process.env.OPERATIONS_NOTIFICATION_EMAIL || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
}

export async function enqueueOperationsAlert(db: Queryable, input: { eventKey: string; eventType: string; title: string; message: string; href: string }) {
  for (const [index, recipient] of operationsRecipients().entries())
    await enqueueMail(db, {
      eventKey: `${input.eventKey}:ops:${index}`,
      eventType: input.eventType,
      recipient,
      audience: "operations",
      template: "operations.alert",
      data: input,
    });
}
