import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  Order,
  OrderItem,
  Product,
  ShippingZone,
  Voucher,
  Vendor,
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
import { enqueueMail, enqueueOperationsAlert } from "./mail/queue";
import { isTestBuyer } from "./test-buyer";
import { isPurchasableVariant } from "@/lib/catalog-visibility";
import { enqueueNotification } from "./notifications";
import { proximityLabel, vendorLocations } from "@/lib/fulfillment";

type Input = ReturnType<typeof checkout.parse>;
export async function quoteCart(db: Queryable, user: Viewer, input: Input) {
  if (isTestBuyer(user))
    throw new HttpError(
      409,
      "Checkout is disabled for the private test catalogue.",
    );
  if (input.orderId) return quoteSourced(db, user, input.orderId, input);
  const acc = await account(db, user);
  if (!acc.cart.length) throw new HttpError(409, "Your cart is empty.");
  const items: OrderItem[] = [];
  let subtotal = 0;
  for (const line of acc.cart) {
    const product = await record<Product>(db, "products", line.productId, true);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    const category = product
      ? await record<{ active?: boolean; restricted: boolean }>(
          db,
          "categories",
          product.categorySlug,
        )
      : null;
    if (
      !product ||
      !variant ||
      !isPurchasableVariant(product, category, variant)
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
      `SELECT available,fulfillment_location_id
       FROM inventory
       WHERE product_id=$1 AND variant_id=$2 AND available >= $3`,
      [product.id, variant.id, line.quantity],
    );
    const vendor = await record<Vendor>(db, "vendors", product.vendorId);
    const locations = vendor
      ? vendorLocations(vendor).filter((location) => location.active)
      : [];
    const stocked = inventory.rows
      .map((row) => ({
        row,
        location:
          locations.find(
            (location) => location.id === row.fulfillment_location_id,
          ) ||
          locations.find((location) => location.isPrimary) ||
          locations[0],
      }))
      .filter((entry) => entry.location)
      .sort((left, right) => {
        const rank = (entry: typeof left) => {
          const proximity = proximityLabel(entry.location!, input.address);
          return proximity === "same-city"
            ? 0
            : proximity === "same-state"
              ? 1
              : 2;
        };
        return (
          rank(left) - rank(right) ||
          Number(right.row.available) - Number(left.row.available)
        );
      });
    const selectedStock = stocked[0];
    if (!selectedStock)
      throw new HttpError(
        409,
        `${product.name} has insufficient confirmed stock. Reduce the quantity or request sourcing.`,
      );
    subtotal += kobo(variant.price) * line.quantity;
    items.push({
      lineId: randomUUID(),
      productId: product.id,
      variantId: variant.id,
      sku: variant.sku,
      name: product.name,
      variantLabel: variant.label,
      image: product.images[0],
      unitPrice: variant.price,
      costPrice: product.costPrice,
      quantity: line.quantity,
      vendorId: product.vendorId,
      categorySlug: product.categorySlug,
      fulfillmentLocationId: selectedStock.row.fulfillment_location_id,
      fulfillmentCity: selectedStock.location!.city,
      fulfillmentState: selectedStock.location!.state,
      fulfillmentDispatchLeadTimeDays:
        selectedStock.location!.dispatchLeadTimeDays,
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
    const now = Date.now();
    if (
      !voucher ||
      !voucher.active ||
      (voucher.startAt && Date.parse(voucher.startAt) > now) ||
      (voucher.endAt && Date.parse(voucher.endAt) < now) ||
      (voucher.usageLimit !== undefined &&
        (voucher.usageCount ?? 0) >= voucher.usageLimit) ||
      subtotal < kobo(voucher.minimum)
    )
      throw new HttpError(
        400,
        "This promotion is unavailable or the minimum spend has not been reached.",
      );
    if (voucher.perCustomerLimit !== undefined) {
      const priorUses = await db.query(
        `SELECT count(*)::int AS count FROM commerce_record
         WHERE kind='orders' AND owner_id=$1
           AND data->>'voucherCode'=$2
           AND data->>'paymentStatus' IN ('paid','refunded')`,
        [user.id, voucher.code],
      );
      if (Number(priorUses.rows[0]?.count ?? 0) >= voucher.perCustomerLimit)
        throw new HttpError(
          400,
          "You have reached the usage limit for this promotion.",
        );
    }
    const eligibleSubtotal = items.reduce((sum, item) => {
      if (
        voucher.categorySlugs?.length &&
        !voucher.categorySlugs.includes(item.categorySlug)
      )
        return sum;
      if (
        voucher.productIds?.length &&
        !voucher.productIds.includes(item.productId)
      )
        return sum;
      return sum + kobo(item.unitPrice) * item.quantity;
    }, 0);
    if (eligibleSubtotal <= 0)
      throw new HttpError(
        400,
        "This promotion does not apply to the items in your cart.",
      );
    discount = Math.min(
      eligibleSubtotal,
      voucher.type === "percent"
        ? Math.floor((eligibleSubtotal * voucher.value) / 100)
        : kobo(voucher.value),
    );
    if (
      voucher.budgetCap !== undefined &&
      kobo(voucher.discountUsed ?? 0) + discount > kobo(voucher.budgetCap)
    )
      throw new HttpError(
        400,
        "This promotion has reached its discount budget.",
      );
  }
  const locationGroups = Object.values(
    Object.groupBy(
      items,
      (item) => item.fulfillmentLocationId || item.vendorId,
    ),
  ).filter(Boolean) as OrderItem[][];
  const bands = await db.query(
    "SELECT id,label,fee,transit_days_min,transit_days_max FROM delivery_band WHERE active=true",
  );
  const bandById = new Map(bands.rows.map((band) => [band.id, band]));
  const shipments = locationGroups.map((group) => {
    const first = group[0];
    const proximity = proximityLabel(
      {
        city: first.fulfillmentCity || "",
        state: first.fulfillmentState || "",
      },
      input.address,
    );
    const bandId = proximity.replace("-", "_");
    const band = bandById.get(bandId);
    if (bands.rows.length && !band)
      throw new HttpError(
        409,
        `Delivery pricing for ${proximity.replace("-", " ")} shipments needs a quotation.`,
      );
    const dispatchDays = Math.max(
      0,
      ...group.map((item) => item.fulfillmentDispatchLeadTimeDays ?? 0),
    );
    return {
      vendorId: first.vendorId,
      fulfillmentLocationId: first.fulfillmentLocationId,
      originCity: first.fulfillmentCity,
      originState: first.fulfillmentState,
      fee: band ? Number(band.fee) : 0,
      eta: band
        ? `${dispatchDays + Number(band.transit_days_min)}–${dispatchDays + Number(band.transit_days_max)} days`
        : zone.eta,
      items: group,
    };
  });
  const deliveryFee = kobo(
    bands.rows.length
      ? shipments.reduce((sum, shipment) => sum + shipment.fee, 0)
      : zone.fee,
  );
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
    shipments,
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
export async function initialize(
  user: Viewer,
  input: Input,
  key: string,
  callbackUrl?: string,
) {
  if (!process.env.PAYSTACK_SECRET_KEY)
    throw new HttpError(503, "Paystack is not configured yet.");
  if (input.orderId) {
    await prepareSourcedPayment(user, input.orderId, input);
    return resumePayment(user, input.orderId, callbackUrl);
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
    const groups = Object.groupBy(
      quote.items,
      (item) => `${item.vendorId}:${item.fulfillmentLocationId || "primary"}`,
    );
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
      voucherCode: input.voucherCode
        ? input.voucherCode.toUpperCase()
        : undefined,
      total: quote.total,
      address: { ...input.address, id: randomUUID(), isDefault: false },
      vendorGroups: Object.entries(groups).map(([groupKey, items]) => {
        const vendorId = groupKey.split(":")[0];
        const shipment = ("shipments" in quote ? quote.shipments : []).find(
          (candidate) =>
            candidate.vendorId === vendorId &&
            candidate.fulfillmentLocationId === items![0].fulfillmentLocationId,
        );
        return {
          id: randomUUID(),
          vendorId,
          items: items!,
          stage: "awaiting_assignment",
          assignee: "",
          eta: shipment?.eta || quote.eta,
          urgent: false,
          notes: "",
          updatedAt: new Date().toISOString(),
          fulfillmentLocationId: shipment?.fulfillmentLocationId,
          originCity: shipment?.originCity,
          originState: shipment?.originState,
          deliveryFee: shipment?.fee,
        };
      }),
      timeline: [
        { label: "Awaiting payment", at: new Date().toISOString(), done: true },
      ],
      notes: input.notes,
      trackingCode: randomUUID(),
    };
    const cart = (await account(db, user)).cart;
    for (const line of cart) {
      const quotedItem = quote.items.find(
        (item) =>
          item.productId === line.productId &&
          item.variantId === line.variantId,
      );
      if (!quotedItem?.fulfillmentLocationId)
        throw new HttpError(
          409,
          "A fulfilment location is no longer available.",
        );
      const reserved = await db.query(
        `UPDATE inventory SET available=available-$4,updated_at=now()
         WHERE product_id=$1 AND variant_id=$2 AND fulfillment_location_id=$3
           AND available >= $4 RETURNING available`,
        [
          line.productId,
          line.variantId,
          quotedItem.fulfillmentLocationId,
          line.quantity,
        ],
      );
      if (!reserved.rows.length)
        throw new HttpError(409, "Stock changed. Review your cart.");
      await db.query(
        `INSERT INTO inventory_reservation(
          order_id,product_id,variant_id,fulfillment_location_id,quantity
        ) VALUES($1,$2,$3,$4,$5)`,
        [
          id,
          line.productId,
          line.variantId,
          quotedItem.fulfillmentLocationId,
          line.quantity,
        ],
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
  return resumePayment(user, order.id, callbackUrl);
}
export async function resumePayment(
  user: Viewer,
  orderId: string,
  callbackUrl?: string,
) {
  const result = await database().query(
    "SELECT * FROM payment WHERE order_id=$1 AND owner_id=$2",
    [orderId, user.id],
  );
  const payment = result.rows[0];
  if (!payment) throw new HttpError(404, "Payment not found.");
  if (payment.status === "paid")
    return { orderId, reference: payment.reference, status: "paid" };
  if (payment.status !== "pending")
    throw new HttpError(
      409,
      "This payment attempt is closed. Review your cart and start a new checkout.",
    );
  if (payment.authorization_url)
    return {
      orderId,
      reference: payment.reference,
      url: payment.authorization_url,
    };
  const data = await paystack("/transaction/initialize", "POST", {
    email: payment.email,
    amount: Number(payment.amount_kobo),
    currency: "NGN",
    reference: payment.reference,
    callback_url:
      callbackUrl ?? `${process.env.BETTER_AUTH_URL}/checkout/success`,
    metadata: { orderId: payment.order_id },
  });
  const url = new URL(data.authorization_url);
  if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com")
    throw new HttpError(502, "Unexpected payment redirect.");
  await database().query(
    "UPDATE payment SET authorization_url=$2 WHERE reference=$1",
    [payment.reference, url.href],
  );
  return { orderId, reference: payment.reference, url: url.href };
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
            `UPDATE inventory SET available=available+$4
             WHERE product_id=$1 AND variant_id=$2 AND fulfillment_location_id=$3`,
            [
              item.product_id,
              item.variant_id,
              item.fulfillment_location_id,
              item.quantity,
            ],
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
    if (order.voucherCode) {
      const voucher = await record<Voucher>(db, "vouchers", order.voucherCode);
      if (voucher) {
        await put(db, "vouchers", voucher.code, {
          ...voucher,
          usageCount: (voucher.usageCount ?? 0) + 1,
          discountUsed: (voucher.discountUsed ?? 0) + order.discount,
        });
      }
    }
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
      "SELECT product_id,variant_id,fulfillment_location_id,quantity FROM inventory_reservation WHERE order_id=$1",
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
    await enqueueMail(db, {
      eventKey: `payment:${reference}:paid:customer`,
      eventType: "payment.received",
      recipient: order.customerEmail,
      template: "payment.received",
      data: {
        reference: order.reference,
        orderId: order.id,
        amount: new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
        }).format(order.total),
      },
    });
    await enqueueOperationsAlert(db, {
      eventKey: `payment:${reference}:paid`,
      eventType: "payment.received",
      title: "Payment confirmed",
      message: `Paystack confirmed payment for order ${order.reference}.`,
      href: `/admin/orders/${order.id}`,
    });
    await enqueueNotification(db, {
      ownerId: order.customerId,
      eventKey: `payment:${reference}:paid`,
      type: "payment.received",
      title: "Payment confirmed",
      body: `Payment for ${order.reference} has been confirmed.`,
      href: `/account/orders/${order.id}`,
    });
  });
  return { status: "paid", orderId: payment.order_id };
}
