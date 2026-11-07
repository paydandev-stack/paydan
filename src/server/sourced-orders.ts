import { randomUUID } from "node:crypto";
import type { Order, ShippingZone, SourcingRequest } from "@/lib/types";
import { record, records, put, transaction, type Queryable } from "./db";
import { HttpError, type Viewer } from "./http";
import { checkout, kobo, naira } from "./schemas";
type Input = ReturnType<typeof checkout.parse>;
export async function quoteSourced(
  db: Queryable,
  user: Viewer,
  orderId: string,
  input: Input,
) {
  const order = await record<Order>(db, "orders", orderId, true);
  if (!order || order.customerId !== user.id)
    throw new HttpError(404, "Order not found.");
  if (
    order.paymentStatus !== "pending" ||
    order.fulfillmentStatus !== "awaiting_payment"
  )
    throw new HttpError(409, "This order is not awaiting payment.");
  const source = (await records<SourcingRequest>(db, "sourcing", user.id)).find(
    (r) => r.convertedOrderId === orderId,
  );
  if (
    !source?.quote ||
    source.quote.status !== "accepted" ||
    Date.parse(source.quote.validUntil) < Date.now()
  )
    throw new HttpError(
      409,
      "This sourcing quote has expired or is unavailable. Contact the sourcing team.",
    );
  const supply = await record<{ confirmed: boolean }>(
    db,
    "sourcedSupply",
    orderId,
  );
  if (!supply?.confirmed || !order.vendorGroups.length)
    throw new HttpError(
      409,
      "Our team must confirm the supplier before you can pay for this sourced order.",
    );
  const zone = (await records<ShippingZone>(db, "shippingZones")).find(
    (z) => z.active && z.state === input.address.state,
  );
  if (!zone)
    throw new HttpError(
      409,
      "Delivery to this state needs a quotation before payment.",
    );
  const subtotal = order.items.reduce(
    (sum, item) => sum + kobo(item.unitPrice) * item.quantity,
    0,
  );
  const deliveryFee = kobo(zone.fee);
  if (input.voucherCode)
    throw new HttpError(
      400,
      "Promotions do not apply to individually quoted sourcing orders.",
    );
  return {
    items: order.items,
    subtotal: naira(subtotal),
    deliveryFee: naira(deliveryFee),
    discount: 0,
    total: naira(subtotal + deliveryFee),
    amountKobo: subtotal + deliveryFee,
    eta: zone.eta,
  };
}
export async function prepareSourcedPayment(
  user: Viewer,
  orderId: string,
  input: Input,
) {
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [user.id]);
    const existing = await db.query(
      "SELECT reference FROM payment WHERE order_id=$1 AND owner_id=$2",
      [orderId, user.id],
    );
    if (existing.rows.length) return;
    const quote = await quoteSourced(db, user, orderId, input);
    if (
      input.expectedTotal === undefined ||
      kobo(input.expectedTotal) !== quote.amountKobo
    )
      throw new HttpError(409, "The total changed. Review your order again.");
    const order = (await record<Order>(db, "orders", orderId, true))!;
    Object.assign(order, {
      subtotal: quote.subtotal,
      deliveryFee: quote.deliveryFee,
      total: quote.total,
      address: { ...input.address, id: randomUUID(), isDefault: false },
      customerPhone: input.phone,
      notes: input.notes,
    });
    await put(db, "orders", orderId, order, user.id);
    await db.query(
      "INSERT INTO payment(reference,order_id,owner_id,amount_kobo,currency,email) VALUES($1,$2,$3,$4,'NGN',$5)",
      [order.reference, orderId, user.id, quote.amountKobo, user.email],
    );
  });
}
