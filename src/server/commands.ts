import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  Address,
  CartLine,
  DemoState,
  Order,
  Product,
  Quote,
  ReturnRequest,
  SourcingRequest,
  TeamMember,
} from "@/lib/types";
import { emptyState } from "@/lib/empty-state";
import { put, record, records, transaction, type Queryable } from "./db";
import { HttpError, requireRole, type Viewer } from "./http";
import * as s from "./schemas";

export async function command(
  user: Viewer,
  name: string,
  args: unknown[],
  key: string,
) {
  s.id.parse(key);
  const digest = createHash("sha256")
    .update(JSON.stringify({ name, args }))
    .digest("hex");
  return transaction(async (db) => {
    // A per-account lock serializes cart writes, including chat and checkout on different tabs.
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [user.id]);
    const prior = await db.query(
      "SELECT digest,result FROM command_receipt WHERE owner_id=$1 AND key=$2",
      [user.id, key],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].digest !== digest)
        throw new HttpError(409, "This request key was already used.");
      return prior.rows[0].result;
    }
    const result = await execute(db, user, name, args);
    await db.query(
      "INSERT INTO command_receipt(owner_id,key,digest,result) VALUES($1,$2,$3,$4)",
      [user.id, key, digest, JSON.stringify(result ?? null)],
    );
    await put(db, "audit", randomUUID(), {
      id: randomUUID(),
      actor: user.email,
      action: name,
      record: String(args[0] && typeof args[0] === "string" ? args[0] : ""),
      at: new Date().toISOString(),
    });
    return result ?? null;
  });
}
async function required<T>(
  db: Queryable,
  kind: string,
  id: unknown,
): Promise<T> {
  const value = await record<T>(db, kind, s.id.parse(id), true);
  if (!value) throw new HttpError(404, "Record not found.");
  return value;
}
function own(owner: string | undefined, user: Viewer) {
  if (owner !== user.id) throw new HttpError(404, "Record not found.");
}
async function mail(
  db: Queryable,
  email: string,
  subject: string,
  body: string,
) {
  await db.query(
    "INSERT INTO mail_outbox(id,recipient,subject,body) VALUES($1,$2,$3,$4)",
    [randomUUID(), email, subject, body],
  );
}
export async function account(db: Queryable, user: Viewer) {
  return {
    ...emptyState(),
    ...(await record<Partial<DemoState>>(db, "accounts", user.id)),
  };
}
async function saveAccount(db: Queryable, user: Viewer, a: DemoState) {
  await put(
    db,
    "accounts",
    user.id,
    {
      cart: a.cart,
      wishlist: a.wishlist,
      savedForLater: a.savedForLater,
      addresses: a.addresses,
      location: a.location,
      lastOrderId: a.lastOrderId,
      lastSourcingReference: a.lastSourcingReference,
    },
    user.id,
  );
}
async function validLine(
  db: Queryable,
  pid: unknown,
  vid: unknown,
  qty: unknown,
): Promise<CartLine> {
  const p = await required<Product>(db, "products", pid);
  const variant = p.variants.find((v) => v.id === vid);
  const category = await record<{ restricted: boolean }>(
    db,
    "categories",
    p.categorySlug,
  );
  if (
    category?.restricted ||
    p.status !== "published" ||
    p.restricted ||
    !variant ||
    variant.availability === "out_of_stock"
  )
    throw new HttpError(409, "That selection is unavailable.");
  return {
    productId: p.id,
    variantId: variant.id,
    quantity: s.quantity.parse(qty),
  };
}
async function execute(
  db: Queryable,
  user: Viewer,
  name: string,
  args: unknown[],
) {
  const [a, b, c, d] = args;
  const cartCommands = [
    "addToCart",
    "setQuantity",
    "removeLine",
    "clearCart",
    "saveForLater",
    "moveToCart",
    "toggleWishlist",
    "addAddress",
    "updateAddress",
    "removeAddress",
    "setDefaultAddress",
    "setLocation",
    "mergeIntent",
  ];
  if (cartCommands.includes(name)) {
    const state = await account(db, user);
    const index = state.cart.findIndex(
      (l) => l.productId === a && l.variantId === b,
    );
    if (
      name === "addToCart" ||
      name === "setQuantity" ||
      name === "mergeIntent"
    ) {
      const input =
        name === "mergeIntent"
          ? z
              .object({
                productId: s.id,
                variantId: s.id,
                quantity: s.quantity,
              })
              .parse(a)
          : { productId: a, variantId: b, quantity: c ?? 1 };
      const line = await validLine(
        db,
        input.productId,
        input.variantId,
        input.quantity,
      );
      const i = state.cart.findIndex(
        (l) => l.productId === line.productId && l.variantId === line.variantId,
      );
      if (i >= 0)
        state.cart[i] = {
          ...line,
          quantity: s.quantity.parse(
            name === "setQuantity"
              ? line.quantity
              : state.cart[i].quantity + line.quantity,
          ),
        };
      else state.cart.push(line);
      if (state.cart.length > 100)
        throw new HttpError(400, "Your cart can contain up to 100 selections.");
    } else if (name === "removeLine")
      state.cart = state.cart.filter((_, i) => i !== index);
    else if (name === "clearCart") state.cart = [];
    else if (name === "saveForLater") {
      if (index >= 0) {
        state.savedForLater = state.savedForLater.filter(
          (l) => !(l.productId === a && l.variantId === b),
        );
        state.savedForLater.push(state.cart[index]);
        state.cart.splice(index, 1);
      }
    } else if (name === "moveToCart") {
      const line = state.savedForLater.find(
        (l) => l.productId === a && l.variantId === b,
      );
      if (line) {
        await validLine(db, a, b, line.quantity);
        if (index < 0) state.cart.push(line);
        else
          state.cart[index].quantity = s.quantity.parse(
            state.cart[index].quantity + line.quantity,
          );
        state.savedForLater = state.savedForLater.filter((l) => l !== line);
      }
    } else if (name === "toggleWishlist") {
      const p = await required<Product>(db, "products", a);
      if (p.status !== "published" || p.restricted)
        throw new HttpError(404, "Product not found.");
      state.wishlist = state.wishlist.includes(p.id)
        ? state.wishlist.filter((id) => id !== p.id)
        : [...state.wishlist, p.id];
    } else if (name === "addAddress") {
      const value = s.address.parse(a);
      if (state.addresses.length >= 20)
        throw new HttpError(400, "Address limit reached.");
      if (value.isDefault)
        state.addresses.forEach((v) => (v.isDefault = false));
      state.addresses.push({
        ...value,
        id: randomUUID(),
        isDefault: value.isDefault ?? state.addresses.length === 0,
      } as Address);
    } else if (name === "updateAddress") {
      const current = state.addresses.find((v) => v.id === a);
      if (!current) throw new HttpError(404, "Address not found.");
      const value = s.address.partial().omit({ id: true }).parse(b);
      if (value.isDefault)
        state.addresses.forEach((v) => (v.isDefault = false));
      Object.assign(current, value);
    } else if (name === "removeAddress")
      state.addresses = state.addresses.filter((v) => v.id !== a);
    else if (name === "setDefaultAddress") {
      if (!state.addresses.some((v) => v.id === a))
        throw new HttpError(404, "Address not found.");
      state.addresses.forEach((v) => (v.isDefault = v.id === a));
    } else if (name === "setLocation")
      state.location = z.object({ state: s.short, city: s.text }).parse(a);
    if (state.addresses.length && !state.addresses.some((v) => v.isDefault))
      state.addresses[0].isDefault = true;
    await saveAccount(db, user, state);
    return null;
  }
  if (name === "updateCustomer") {
    if (a !== user.id) requireRole(user, ["Support"]);
    const patch = z
      .object({
        name: s.short.optional(),
        phone: s.text.optional(),
        city: s.text.optional(),
        state: s.text.optional(),
        notes: s.text.optional(),
        email: z.email().optional(),
      })
      .parse(b);
    if (a === user.id && patch.email && patch.email !== user.email)
      throw new HttpError(
        400,
        "Email changes require verification and cannot be made here.",
      );
    if (!user.role) delete patch.notes;
    await put(
      db,
      "customers",
      s.id.parse(a),
      {
        ...(await record<Record<string, unknown>>(
          db,
          "customers",
          s.id.parse(a),
        )),
        ...patch,
        id: a,
      },
      s.id.parse(a),
    );
    if (a === user.id && patch.name)
      await db.query('UPDATE "user" SET name=$1 WHERE id=$2', [
        patch.name,
        user.id,
      ]);
    return null;
  }
  if (name === "submitSourcing") {
    const value = s.sourcing.parse(a);
    for (const url of value.images ?? []) {
      const mediaId = url.split("/").pop();
      const found = await db.query(
        "SELECT id FROM media WHERE id=$1 AND owner_id=$2 AND purpose='sourcing' AND status='ready'",
        [mediaId, user.id],
      );
      if (!found.rows.length)
        throw new HttpError(
          400,
          "An attachment is not available to this account.",
        );
    }
    const requestId = randomUUID();
    const reference = `SR-${requestId.slice(0, 8).toUpperCase()}`;
    const request = {
      ...value,
      id: requestId,
      reference,
      customerId: user.id,
      customerName: user.name,
      email: user.email,
      images: value.images ?? [],
      status: "received",
      submittedAt: new Date().toISOString(),
      assignee: "",
      adminNotes: "",
    };
    await put(db, "sourcing", requestId, request, user.id);
    const acc = await account(db, user);
    acc.lastSourcingReference = reference;
    await saveAccount(db, user, acc);
    await mail(
      db,
      user.email,
      "PAYDAN sourcing request received",
      `Your request ${reference} is being reviewed. View updates in your dashboard.`,
    );
    return reference;
  }
  if (name === "respondToQuote") {
    const request = await required<SourcingRequest>(db, "sourcing", a);
    own(request.customerId, user);
    if (
      !request.quote ||
      request.quote.status !== "sent" ||
      Date.parse(request.quote.validUntil) < Date.now()
    )
      throw new HttpError(409, "This quote is no longer available.");
    request.quote.status = z.enum(["accepted", "declined"]).parse(b);
    request.quote.respondedAt = new Date().toISOString();
    request.status = request.quote.status;
    await put(db, "sourcing", request.id, request, user.id);
    return null;
  }
  if (name === "createReturn") {
    const value = z
      .object({
        orderId: s.id,
        productId: s.id,
        quantity: s.quantity,
        reason: s.short,
        detail: s.text,
        images: z.array(s.image).max(5).optional(),
      })
      .parse(a);
    for (const url of value.images ?? []) {
      const found = await db.query(
        "SELECT id FROM media WHERE id=$1 AND owner_id=$2 AND purpose='return' AND status='ready'",
        [url.split("/").pop(), user.id],
      );
      if (!found.rows.length) throw new HttpError(400, "Attachment not found.");
    }
    const order = await required<Order>(db, "orders", value.orderId);
    own(order.customerId, user);
    if (
      order.paymentStatus !== "paid" ||
      order.fulfillmentStatus !== "delivered"
    )
      throw new HttpError(
        409,
        "Returns are available for paid, delivered orders.",
      );
    const item = order.items.find((i) => i.productId === value.productId);
    const returns = await records<ReturnRequest>(db, "returns", user.id);
    const requested = returns
      .filter(
        (r) =>
          r.orderId === order.id &&
          r.productId === value.productId &&
          r.status !== "rejected",
      )
      .reduce((sum, r) => sum + r.quantity, 0);
    if (!item || value.quantity + requested > item.quantity)
      throw new HttpError(
        400,
        "The return quantity exceeds the purchased quantity.",
      );
    const id = randomUUID();
    const result = {
      ...value,
      id,
      reference: `RT-${id.slice(0, 8)}`,
      customerId: user.id,
      productName: item.name,
      status: "requested",
      createdAt: new Date().toISOString(),
      adminNote: "",
    };
    await put(db, "returns", id, result, user.id);
    return result;
  }
  if (name === "cancelOrder") {
    const order = await required<Order>(db, "orders", a);
    if (order.customerId !== user.id) requireRole(user, ["Order Manager"]);
    if (
      order.paymentStatus !== "pending" ||
      order.fulfillmentStatus !== "awaiting_payment"
    )
      throw new HttpError(
        409,
        "Contact support to cancel or refund an order after payment.",
      );
    const payment = await db.query(
      "SELECT reference FROM payment WHERE order_id=$1",
      [order.id],
    );
    if (payment.rows.length)
      throw new HttpError(
        409,
        "A payment is in progress. Contact support for cancellation.",
      );
    order.fulfillmentStatus = "cancelled";
    await put(db, "orders", order.id, order, order.customerId);
    return null;
  }
  const roles: Record<string, Parameters<typeof requireRole>[1]> = {
    saveShippingZone: ["Order Manager"],
    saveProduct: ["Catalog Manager"],
    setProductStatus: ["Catalog Manager"],
    saveCategory: ["Catalog Manager"],
    updateCategory: ["Catalog Manager"],
    saveVendor: ["Procurement Manager"],
    updateShippingZone: ["Order Manager"],
    updateSourcing: ["Procurement Manager"],
    setSourcingStatus: ["Procurement Manager"],
    saveQuote: ["Procurement Manager"],
    sendQuote: ["Procurement Manager"],
    convertQuoteToOrder: ["Procurement Manager"],
    saveVoucher: ["Catalog Manager"],
    toggleVoucher: ["Catalog Manager"],
    saveBanner: ["Catalog Manager"],
    toggleBanner: ["Catalog Manager"],
    updateOrderStatus: ["Order Manager"],
    updateVendorStage: ["Procurement Manager"],
    addTeamMember: [],
    updateTeamMember: [],
    updateSettings: [],
    updateReturn: ["Order Manager", "Support"],
  };
  if (!(name in roles)) throw new HttpError(400, "Unknown action.");
  requireRole(user, roles[name]);
  if (name === "saveShippingZone") {
    const value = z
      .object({
        id: s.id,
        state: s.short,
        fee: s.amount,
        eta: s.short,
        active: z.boolean(),
      })
      .parse(a);
    const previous = (
      await records<{ id: string; state: string }>(db, "shippingZones")
    ).find((z) => z.state === value.state);
    if (previous) value.id = previous.id;
    await put(db, "shippingZones", value.id, value);
  } else if (name === "saveProduct") {
    const value = s.product.parse(a);
    if (
      !(await record(db, "categories", value.categorySlug)) ||
      !(await record(db, "vendors", value.vendorId))
    )
      throw new HttpError(400, "Select an existing category and supplier.");
    if (new Set(value.variants.map((v) => v.id)).size !== value.variants.length)
      throw new HttpError(400, "Variant IDs must be unique.");
    await put(db, "products", value.id, {
      ...value,
      updatedAt: new Date().toISOString(),
    });
  } else if (name === "saveCategory") {
    const value = s.category.parse(a);
    await put(db, "categories", value.slug, value);
  } else if (name === "saveVendor") {
    const value = s.vendor.parse(a);
    await put(db, "vendors", value.id, value);
  } else if (name === "saveVoucher") {
    const value = s.voucher.parse(a);
    await put(db, "vouchers", value.code, value);
  } else if (name === "saveBanner") {
    const value = s.banner.parse(a);
    await put(db, "banners", value.id, value);
  } else if (name === "setProductStatus") {
    const value = await required<Product>(db, "products", a);
    value.status = s.product.shape.status.parse(b);
    await put(db, "products", value.id, value);
  } else if (name === "updateCategory") {
    const value = await required<Record<string, unknown>>(db, "categories", a);
    await put(db, "categories", s.id.parse(a), {
      ...value,
      ...s.category.omit({ slug: true }).partial().parse(b),
    });
  } else if (name === "updateShippingZone") {
    const value = await required<Record<string, unknown>>(
      db,
      "shippingZones",
      a,
    );
    await put(db, "shippingZones", s.id.parse(a), {
      ...value,
      ...z
        .object({ fee: s.amount, eta: s.short, active: z.boolean() })
        .partial()
        .parse(b),
    });
  } else if (name === "toggleVoucher" || name === "toggleBanner") {
    const kind = name === "toggleVoucher" ? "vouchers" : "banners";
    const value = await required<{ active: boolean }>(db, kind, a);
    value.active = !value.active;
    await put(db, kind, s.id.parse(a), value);
  } else if (name === "addTeamMember" || name === "updateTeamMember") {
    const prior =
      name === "updateTeamMember"
        ? await required<TeamMember>(db, "team", a)
        : null;
    const value = s.team.parse(
      prior
        ? {
            ...prior,
            ...z
              .object({
                name: s.short,
                email: z.email(),
                role: s.role,
                status: s.team.shape.status,
              })
              .partial()
              .parse(b),
          }
        : a,
    );
    if (
      value.email === user.email &&
      (value.role !== "Super Admin" || value.status !== "active")
    )
      throw new HttpError(
        409,
        "Another super administrator must change your access.",
      );
    const id = prior?.id ?? randomUUID();
    await put(db, "team", id, { ...value, id });
    if (value.status === "invited")
      await mail(
        db,
        value.email,
        "You have been invited to PAYDAN operations",
        `Create and verify an account at ${process.env.BETTER_AUTH_URL}/register. A super administrator must then activate your team access.`,
      );
  } else if (name === "updateSettings") {
    const patch = z
      .object({
        storeName: s.short,
        supportEmail: z.email(),
        supportPhone: s.short,
        businessHours: s.short,
        announcement: s.text,
      })
      .partial()
      .parse(a);
    await put(db, "settings", "store", {
      ...(await record<Record<string, unknown>>(db, "settings", "store")),
      ...patch,
      currency: "NGN",
      transferEnabled: false,
    });
  } else if (name === "updateOrderStatus") {
    const order = await required<Order>(db, "orders", a);
    const patch = z
      .object({
        fulfillmentStatus: z.enum([
          "processing",
          "sourcing",
          "partially_packed",
          "dispatched",
          "delivered",
        ]),
        notes: s.text.optional(),
      })
      .partial()
      .parse(b);
    if (
      b &&
      typeof b === "object" &&
      "paymentStatus" in b &&
      b.paymentStatus !== order.paymentStatus
    )
      throw new HttpError(
        400,
        "Payment status is controlled by verified Paystack events.",
      );
    if (patch.fulfillmentStatus && order.paymentStatus !== "paid")
      throw new HttpError(409, "Verify payment before fulfillment.");
    const transitions: Record<string, string[]> = {
      processing: ["sourcing", "partially_packed", "dispatched"],
      sourcing: ["processing", "partially_packed"],
      partially_packed: ["dispatched"],
      dispatched: ["delivered"],
      delivered: [],
      cancelled: [],
    };
    if (
      patch.fulfillmentStatus &&
      patch.fulfillmentStatus !== order.fulfillmentStatus &&
      !transitions[order.fulfillmentStatus]?.includes(patch.fulfillmentStatus)
    )
      throw new HttpError(409, "This fulfillment transition is not allowed.");
    Object.assign(order, patch);
    if (patch.fulfillmentStatus)
      order.timeline.push({
        label: patch.fulfillmentStatus.replaceAll("_", " "),
        at: new Date().toISOString(),
        done: true,
      });
    await put(db, "orders", order.id, order, order.customerId);
    await mail(
      db,
      order.customerEmail,
      `PAYDAN order ${order.reference} updated`,
      `Your order is ${order.fulfillmentStatus.replaceAll("_", " ")}. View your dashboard for details.`,
    );
  } else if (name === "updateVendorStage") {
    const order = await required<Order>(db, "orders", a);
    const group = order.vendorGroups.find((g) => g.id === b);
    if (!group) throw new HttpError(404, "Supplier group not found.");
    if (
      [
        "ordered_from_supplier",
        "supplier_fulfilled",
        "ready_for_dispatch",
        "closed",
      ].includes(String(c)) &&
      order.paymentStatus !== "paid"
    )
      throw new HttpError(
        409,
        "Verify payment before instructing the supplier.",
      );
    group.stage = z
      .enum([
        "awaiting_assignment",
        "contact_vendor",
        "awaiting_confirmation",
        "ordered_from_supplier",
        "supplier_fulfilled",
        "ready_for_dispatch",
        "blocked",
        "closed",
      ])
      .parse(c);
    group.notes = s.text.parse(d ?? group.notes);
    group.updatedAt = new Date().toISOString();
    await put(db, "orders", order.id, order, order.customerId);
  } else if (name === "updateReturn") {
    const value = await required<ReturnRequest>(db, "returns", a);
    const patch = z
      .object({
        status: z.enum(["under_review", "approved", "rejected"]),
        adminNote: s.text,
      })
      .parse(b);
    if (value.status === "refunded")
      throw new HttpError(409, "This return is already refunded.");
    Object.assign(value, patch);
    await put(db, "returns", value.id, value, value.customerId);
  } else {
    const request = await required<SourcingRequest>(db, "sourcing", a);
    if (name === "saveQuote") {
      if (request.quote?.status === "accepted" || request.convertedOrderId)
        throw new HttpError(409, "Accepted quotes cannot be edited.");
      const value = s.quote.parse(b);
      value.status = "draft";
      value.total = s.naira(
        value.lines.reduce(
          (sum, l) => sum + s.kobo(l.unitPrice) * l.quantity,
          0,
        ),
      );
      request.quote = value as Quote;
      request.status = "quote_ready";
    }
    if (name === "sendQuote") {
      if (
        !request.quote ||
        request.quote.status !== "draft" ||
        Date.parse(request.quote.validUntil) <= Date.now()
      )
        throw new HttpError(409, "Save a valid draft quote first.");
      request.quote.status = "sent";
      request.quote.sentAt = new Date().toISOString();
      request.status = "awaiting_customer";
      await mail(
        db,
        request.email,
        "Your PAYDAN quotation is ready",
        `Review request ${request.reference} in your dashboard before ${request.quote.validUntil}.`,
      );
    }
    if (name === "updateSourcing" || name === "setSourcingStatus") {
      const patch = z
        .object({
          adminNotes: s.text.optional(),
          assignee: s.text.optional(),
          status: z
            .enum(["received", "under_review", "vendor_sourcing", "cancelled"])
            .optional(),
        })
        .parse(name === "setSourcingStatus" ? { status: b } : b);
      Object.assign(request, patch);
    }
    if (name === "convertQuoteToOrder") {
      if (request.convertedOrderId) return request.convertedOrderId;
      if (
        !request.customerId ||
        request.quote?.status !== "accepted" ||
        Date.parse(request.quote.validUntil) < Date.now()
      )
        throw new HttpError(409, "An accepted, valid quote is required.");
      // Conversion records an unpaid order. Address and shipping are required before payment.
      const id = randomUUID();
      const order: Order = {
        id,
        reference: `PD-${id.slice(0, 8).toUpperCase()}`,
        customerId: request.customerId,
        customerName: request.customerName,
        customerEmail: request.email,
        customerPhone: request.phone,
        placedAt: new Date().toISOString(),
        paymentStatus: "pending",
        fulfillmentStatus: "awaiting_payment",
        paymentMethod: "paystack",
        items: request.quote.lines.map((l) => ({
          productId: `${request.id}-${l.id}`,
          name: l.description,
          variantLabel: "Sourced to request",
          image: "/favicon.svg",
          unitPrice: l.unitPrice,
          costPrice: 0,
          quantity: l.quantity,
          vendorId: "",
          categorySlug: request.categorySlug,
        })),
        subtotal: request.quote.total,
        deliveryFee: 0,
        discount: 0,
        total: request.quote.total,
        address: {
          id: randomUUID(),
          label: "Delivery address required",
          recipient: request.customerName,
          phone: request.phone,
          street: "",
          city: request.city,
          state: request.state,
          isDefault: false,
        },
        vendorGroups: [],
        timeline: [
          {
            label: "Quote accepted — delivery details required",
            at: new Date().toISOString(),
            done: true,
          },
        ],
        notes: `Sourcing request ${request.reference}`,
        trackingCode: randomUUID(),
      };
      await put(db, "orders", id, order, request.customerId);
      request.convertedOrderId = id;
      request.status = "converted";
      await put(db, "sourcing", request.id, request, request.customerId);
      return id;
    }
    await put(db, "sourcing", request.id, request, request.customerId);
  }
  return null;
}
