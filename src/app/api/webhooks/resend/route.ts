import { Webhook } from "svix";
import { z } from "zod";
import { database, transaction } from "@/server/db";

export const runtime = "nodejs";

const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string().optional(),
    to: z.union([z.string(), z.array(z.string())]).optional(),
  }).passthrough(),
}).passthrough();

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 100_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let event: z.infer<typeof eventSchema>;
  try {
    event = eventSchema.parse(new Webhook(secret).verify(raw, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }));
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  await transaction(async (db) => {
    const inserted = await db.query(
      "INSERT INTO email_webhook_event(id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
      [id, event.type],
    );
    if (!inserted.rows.length) return;
    const providerId = event.data.email_id;
    if (providerId) {
      if (event.type === "email.delivered")
        await db.query("UPDATE mail_outbox SET delivered_at=now() WHERE provider_message_id=$1", [providerId]);
      if (event.type === "email.delivery_delayed")
        await db.query("UPDATE mail_outbox SET delayed_at=now(),last_error='Provider delivery delayed' WHERE provider_message_id=$1", [providerId]);
      if (event.type === "email.bounced")
        await db.query("UPDATE mail_outbox SET bounced_at=now() WHERE provider_message_id=$1", [providerId]);
      if (event.type === "email.complained")
        await db.query("UPDATE mail_outbox SET complained_at=now() WHERE provider_message_id=$1", [providerId]);
    }
    if (event.type === "email.bounced" || event.type === "email.complained") {
      const recipients = Array.isArray(event.data.to) ? event.data.to : event.data.to ? [event.data.to] : [];
      for (const recipient of recipients)
        await db.query(
          "INSERT INTO email_suppression(recipient,reason) VALUES($1,$2) ON CONFLICT(recipient) DO UPDATE SET reason=excluded.reason,created_at=now()",
          [recipient.toLowerCase(), event.type === "email.bounced" ? "bounce" : "complaint"],
        );
    }
  });
  return Response.json({ received: true });
}
