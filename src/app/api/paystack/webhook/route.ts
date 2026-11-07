import { createHash } from "node:crypto";
import { database } from "@/server/db";
import { failure, json } from "@/server/http";
import { validSignature, verifyPayment } from "@/server/payments";
import { verifyRefund } from "@/server/refunds";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 100000) return json({ error: "Payload too large" }, 413);
    if (
      !process.env.PAYSTACK_SECRET_KEY ||
      !validSignature(
        raw,
        request.headers.get("x-paystack-signature"),
        process.env.PAYSTACK_SECRET_KEY,
      )
    )
      return json({ error: "Invalid signature" }, 401);
    const event = JSON.parse(raw);
    const digest = createHash("sha256").update(raw).digest("hex");
    const seen = await database().query(
      "SELECT digest FROM webhook_event WHERE digest=$1",
      [digest],
    );
    if (seen.rows.length) return json({ received: true });
    if (event.event === "charge.success")
      await verifyPayment(String(event.data.reference));
    if (String(event.event).startsWith("refund."))
      await verifyRefund(String(event.data.id));
    // Payment verification itself is transactional and idempotent, including concurrent webhook deliveries.
    await database().query(
      "INSERT INTO webhook_event(digest,event) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [digest, String(event.event)],
    );
    return json({ received: true });
  } catch (error) {
    return failure(error);
  }
}
