import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  Order,
  OrderItem,
  Product,
  ShippingZone,
  Voucher,
} from "@/lib/types";
import {
  database,
  put,
  record,
  records,
  transaction,
  type Queryable,
} from "./db";
import { account } from "./commands";
import { HttpError, type Viewer } from "./http";
import { quoteSourced, prepareSourcedPayment } from "./sourced-orders";
import { checkout, kobo, naira } from "./schemas";

type Input = ReturnType<typeof checkout.parse>;
export async function quoteCart(db: Queryable, user: Viewer, input: Input) {
  if (input.orderId) return quoteSourced(db, user, input.orderId, input);
  const acc = await account(db, user);
  if (!acc.cart.length) throw new HttpError(409, "Your cart is empty.");
  const items: OrderItem[] = [];
  let subtotal = 0;
  for (const line of acc.cart) {
    const product = await record<Product>(db, "products", line.productId, true);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    const category = product
      ? await record<{ restricted: boolean }>(
          db,
          "categories",
          product.categorySlug,
        )
      : null;
    if (
      category?.restricted ||
      !product ||
      product.status !== "published" ||
      product.restricted ||
      !variant ||
      variant.availability === "out_of_stock"
    )
      throw new HttpError(
        409,
        "An item in your cart is no longer available. Review your cart.",
      );
    if (variant.availability !== "in_stock")
      throw new HttpError(
        409,
        `${product.name} needs supplier confirmation before payment. Submit a sourcing request for this selection.`,
      );
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99
    )
      throw new HttpError(400, "Invalid cart quantity.");
    const inventory = await db.query(
      "SELECT available FROM inventory WHERE product_id=$1 AND variant_id=$2",
      [product.id, variant.id],
    );
    if (!inventory.rows[0] || inventory.rows[0].available < line.quantity)
      throw new HttpError(
        409,
        `${product.name} has insufficient confirmed stock. Reduce the quantity or request sourcing.`,
      );
    subtotal += kobo(variant.price) * line.quantity;
    items.push({
      productId: product.id,
      name: product.name,
      variantLabel: variant.label,
      image: product.images[0],
      unitPrice: variant.price,
      costPrice: product.costPrice,
      quantity: line.quantity,
      vendorId: product.vendorId,
      categorySlug: product.categorySlug,
    });
  }
  const zones = await records<ShippingZone>(db, "shippingZones");
  const zone = zones.find((z) => z.state === input.address.state && z.active);
  if (!zone)
    throw new HttpError(
      409,
      "Delivery to this state needs a quotation before payment.",
    );
  let discount = 0;
  if (input.voucherCode) {
    const voucher = await record<Voucher>(
      db,
      "vouchers",
      input.voucherCode.toUpperCase(),
    );
    if (!voucher || !voucher.active || subtotal < kobo(voucher.minimum))
      throw new HttpError(
        400,
        "This promotion is unavailable or the minimum spend has not been reached.",
      );
    discount = Math.min(
      subtotal,
      voucher.type === "percent"
        ? Math.floor((subtotal * voucher.value) / 100)
        : kobo(voucher.value),
    );
  }
  const deliveryFee = kobo(zone.fee);
  const total = subtotal + deliveryFee - discount;
  if (!Number.isSafeInteger(total) || total <= 0)
    throw new HttpError(400, "The order total is invalid.");
  return {
    items,
    subtotal: naira(subtotal),
    deliveryFee: naira(deliveryFee),
    discount: naira(discount),
    total: naira(total),
    amountKobo: total,
    eta: zone.eta,
  };
}
export async function paystack(path: string, method = "GET", body?: unknown) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new HttpError(503, "Paystack is not configured yet.");
  const response = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok || !result.status)
    throw new HttpError(
      502,
      "Paystack could not complete this request. Please retry or check your order status.",
    );
  return result.data;
}
export async function initialize(user: Viewer, input: Input, key: string) {
  if (!process.env.PAYSTACK_SECRET_KEY)
    throw new HttpError(503, "Paystack is not configured yet.");
  if (input.orderId) {
    await prepareSourcedPayment(user, input.orderId, input);
    return resumePayment(user, input.orderId);
  }
  const order = await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [user.id]);
    const prior = await db.query(
      "SELECT result FROM command_receipt WHERE owner_id=$1 AND key=$2",
      [user.id, `checkout:${key}`],
    );
    if (prior.rows[0]) return prior.rows[0].result as Order;
    // Do not create another payable order while this cart has an outstanding payment.
    const active = await db.query(
      "SELECT order_id FROM payment WHERE owner_id=$1 AND status='pending'",
      [user.id],
    );
    if (active.rows.length)
      throw new HttpError(
        409,
        "You have a pending payment. Open your orders to resume or verify it before placing another order.",
      );
    const quote = await quoteCart(db, user, input);
    if (
      input.expectedTotal === undefined ||
      kobo(input.expectedTotal) !== quote.amountKobo
    )
      throw new HttpError(
        409,
        "Prices or delivery changed. Review the updated total before paying.",
      );
    const id = randomUUID();
    const reference = `PD-${randomUUID()}`;
    const groups = Object.groupBy(quote.items, (i) => i.vendorId);
    const value: Order = {
      id,
      reference,
      customerId: user.id,
      customerName: input.customerName,
      customerEmail: user.email,
      customerPhone: input.phone,
      placedAt: new Date().toISOString(),
      paymentStatus: "pending",
      fulfillmentStatus: "awaiting_payment",
      paymentMethod: "paystack",
      items: quote.items,
      subtotal: quote.subtotal,
      deliveryFee: quote.deliveryFee,
      discount: quote.discount,
      total: quote.total,
      address: { ...input.address, id: randomUUID(), isDefault: false },
      vendorGroups: Object.entries(groups).map(([vendorId, items]) => ({
        id: randomUUID(),
        vendorId,
        items: items!,
        stage: "awaiting_assignment",
        assignee: "",
        eta: quote.eta,
        urgent: false,
        notes: "",
        updatedAt: new Date().toISOString(),
      })),
      timeline: [
        { label: "Awaiting payment", at: new Date().toISOString(), done: true },
      ],
      notes: input.notes,
      trackingCode: randomUUID(),
    };
    const cart = (await account(db, user)).cart;
    for (const line of cart) {
      const reserved = await db.query(
        "UPDATE inventory SET available=available-$3,updated_at=now() WHERE product_id=$1 AND variant_id=$2 AND available >= $3 RETURNING available",
        [line.productId, line.variantId, line.quantity],
      );
      if (!reserved.rows.length)
        throw new HttpError(409, "Stock changed. Review your cart.");
      await db.query(
        "INSERT INTO inventory_reservation(order_id,product_id,variant_id,quantity) VALUES($1,$2,$3,$4)",
        [id, line.productId, line.variantId, line.quantity],
      );
    }
    await put(db, "orders", id, value, user.id);
    await db.query(
      "INSERT INTO payment(reference,order_id,owner_id,amount_kobo,currency,email) VALUES($1,$2,$3,$4,'NGN',$5)",
      [reference, id, user.id, quote.amountKobo, user.email],
    );
    await db.query(
      "INSERT INTO command_receipt(owner_id,key,digest,result) VALUES($1,$2,'checkout',$3)",
      [user.id, `checkout:${key}`, JSON.stringify(value)],
    );
    const acc = await account(db, user);
    if (input.saveAddress) acc.addresses.push(value.address);
    acc.lastOrderId = id;
    await put(
      db,
      "accounts",
      user.id,
      {
        cart: acc.cart,
        wishlist: acc.wishlist,
        savedForLater: acc.savedForLater,
        addresses: acc.addresses,
        location: acc.location,
        lastOrderId: id,
      },
      user.id,
    );
    return value;
  });
  return resumePayment(user, order.id);
}
export async function resumePayment(user: Viewer, orderId: string) {
  const result = await database().query(
    "SELECT * FROM payment WHERE order_id=$1 AND owner_id=$2",
    [orderId, user.id],
  );
  const payment = result.rows[0];
  if (!payment) throw new HttpError(404, "Payment not found.");
  if (payment.status === "paid") return { orderId, status: "paid" };
  if (payment.status !== "pending")
    throw new HttpError(
      409,
      "This payment attempt is closed. Review your cart and start a new checkout.",
    );
  if (payment.authorization_url)
    return { orderId, url: payment.authorization_url };
  const data = await paystack("/transaction/initialize", "POST", {
    email: payment.email,
    amount: Number(payment.amount_kobo),
    currency: "NGN",
    reference: payment.reference,
    callback_url: `${process.env.BETTER_AUTH_URL}/checkout/success`,
    metadata: { orderId: payment.order_id },
  });
  const url = new URL(data.authorization_url);
  if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com")
    throw new HttpError(502, "Unexpected payment redirect.");
  await database().query(
    "UPDATE payment SET authorization_url=$2 WHERE reference=$1",
    [payment.reference, url.href],
  );
  return { orderId, url: url.href };
}
export function validSignature(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export async function verifyPayment(reference: string, user?: Viewer) {
  const stored = await database().query(
    "SELECT * FROM payment WHERE reference=$1",
    [reference],
  );
  const payment = stored.rows[0];
  if (!payment || (user && payment.owner_id !== user.id))
    throw new HttpError(404, "Payment not found.");
  if (payment.status === "paid")
    return { status: "paid", orderId: payment.order_id };
  const data = await paystack(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  if (data.status !== "success") {
    if (data.status === "failed" || data.status === "abandoned")
      await transaction(async (db) => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          payment.owner_id,
        ]);
        const current = await db.query(
          "SELECT status FROM payment WHERE reference=$1 FOR UPDATE",
          [reference],
        );
        if (current.rows[0].status !== "pending") return;
        const reservations = await db.query(
          "UPDATE inventory_reservation SET status='released' WHERE order_id=$1 AND status='reserved' RETURNING *",
          [payment.order_id],
        );
        for (const item of reservations.rows)
          await db.query(
            "UPDATE inventory SET available=available+$3 WHERE product_id=$1 AND variant_id=$2",
            [item.product_id, item.variant_id, item.quantity],
          );
        await db.query(
          "UPDATE payment SET status='failed' WHERE reference=$1",
          [reference],
        );
        const order = await record<Order>(db, "orders", payment.order_id, true);
        if (order) {
          order.paymentStatus = "failed";
          await put(db, "orders", order.id, order, order.customerId);
        }
      });
    return {
      status:
        data.status === "failed" || data.status === "abandoned"
          ? "failed"
          : "pending",
      orderId: payment.order_id,
    };
  }
  if (
    data.reference !== reference ||
    data.currency !== "NGN" ||
    data.amount !== Number(payment.amount_kobo) ||
    data.customer?.email?.toLowerCase() !== payment.email.toLowerCase() ||
    data.metadata?.orderId !== payment.order_id
  )
    throw new HttpError(
      409,
      "Payment details did not match this order. Contact support.",
    );
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      payment.owner_id,
    ]);
    const current = await db.query(
      "SELECT status FROM payment WHERE reference=$1 FOR UPDATE",
      [reference],
    );
    if (current.rows[0].status === "paid") return;
    const order = await record<Order>(db, "orders", payment.order_id, true);
    if (!order) throw new HttpError(404, "Order not found.");
    if (order.fulfillmentStatus === "cancelled")
      throw new HttpError(409, "This payment needs manual reconciliation.");
    if (current.rows[0].status !== "pending")
      throw new HttpError(
        409,
        "This late payment needs manual reconciliation before fulfillment.",
      );
    await db.query(
      "UPDATE inventory_reservation SET status='consumed' WHERE order_id=$1 AND status='reserved'",
      [order.id],
    );
    order.paymentStatus = "paid";
    order.fulfillmentStatus = "processing";
    order.timeline.push({
      label: "Payment verified",
      at: new Date().toISOString(),
      done: true,
    });
    await put(db, "orders", order.id, order, order.customerId);
    await db.query(
      "UPDATE payment SET status='paid',provider_id=$2,paid_at=now() WHERE reference=$1",
      [reference, String(data.id)],
    );
    // Remove only quantities purchased; items added while Paystack was open survive.
    const acc = await account(db, {
      id: order.customerId,
      name: order.customerName,
      email: order.customerEmail,
    });
    const purchased = await db.query(
      "SELECT product_id,variant_id,quantity FROM inventory_reservation WHERE order_id=$1",
      [order.id],
    );
    for (const item of purchased.rows) {
      const line = acc.cart.find(
        (l) =>
          l.productId === item.product_id && l.variantId === item.variant_id,
      );
      if (line) line.quantity -= item.quantity;
    }
    acc.cart = acc.cart.filter((l) => l.quantity > 0);
    await put(
      db,
      "accounts",
      order.customerId,
      {
        cart: acc.cart,
        wishlist: acc.wishlist,
        savedForLater: acc.savedForLater,
        addresses: acc.addresses,
        location: acc.location,
        lastOrderId: order.id,
      },
      order.customerId,
    );
    await db.query(
      "INSERT INTO mail_outbox(id,recipient,subject,body) VALUES($1,$2,$3,$4)",
      [
        randomUUID(),
        order.customerEmail,
        `PAYDAN payment received — ${order.reference}`,
        `We received NGN ${order.total.toFixed(2)}. Track your order from your dashboard.`,
      ],
    );
  });
  return { status: "paid", orderId: payment.order_id };
}
