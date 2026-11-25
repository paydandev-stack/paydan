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
  Vendor,
} from "@/lib/types";
import type { AdminCapability } from "@/lib/capabilities";
import {
  isCustomerVisibleProduct,
  isPurchasableVariant,
} from "@/lib/catalog-visibility";
import { findOrderLine } from "@/lib/order-lines";
import { publishReadiness } from "./product-readiness";
import { emptyState } from "@/lib/empty-state";
import { put, record, records, transaction, type Queryable } from "./db";
import { HttpError, requireCapability, type Viewer } from "./http";
import * as s from "./schemas";
import { enqueueMail, enqueueOperationsAlert } from "./mail/queue";
import { isTestBuyer, productRecordKind, scopedRecordKind } from "./test-buyer";
import { writeAudit } from "./audit";
import {
  enqueueNotification,
  enqueueViewerNotification,
} from "./notifications";
import { issueVendorInvite, revokeVendorInvites } from "./vendor-invites";

const commandCapabilities: Record<string, AdminCapability> = {
  saveShippingZone: "shipping.write",
  saveProduct: "catalog.write",
  bulkProductStatus: "catalog.write",
  duplicateProduct: "catalog.write",
  bulkReassignProducts: "catalog.write",
  importProducts: "catalog.write",
  scheduleProductPublish: "catalog.write",
  setProductStatus: "catalog.write",
  saveCategory: "departments.write",
  updateCategory: "departments.write",
  saveVendor: "vendors.write",
  updateShippingZone: "shipping.write",
  updateSourcing: "sourcing.write",
  setSourcingStatus: "sourcing.write",
  saveQuote: "sourcing.write",
  sendQuote: "sourcing.write",
  convertQuoteToOrder: "sourcing.write",
  saveVoucher: "promotions.write",
  toggleVoucher: "promotions.write",
  saveBanner: "promotions.write",
  toggleBanner: "promotions.write",
  updateOrderStatus: "orders.fulfil",
  bulkShipOrders: "orders.fulfil",
  adjustStock: "inventory.write",
  updateVendorStage: "sourcing.write",
  bulkUpdateVendorStages: "sourcing.write",
  addTeamMember: "team.manage",
  updateTeamMember: "team.manage",
  createVendorAccount: "team.manage",
  updateVendorAccount: "team.manage",
  unlinkVendorAccount: "team.manage",
  updateSettings: "settings.manage",
  updateReturn: "returns.review",
};

function requireVendor(user: Viewer): string {
  if (user.role !== "Vendor" || !user.vendorId)
    throw new HttpError(403, "Vendor portal access is required.");
  return user.vendorId;
}

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
    if (user.role === "Vendor") {
      const member = user.teamMemberId
        ? await record<TeamMember>(db, "team", user.teamMemberId)
        : undefined;
      if (
        !member ||
        member.status !== "active" ||
        member.role !== "Vendor" ||
        member.vendorId !== user.vendorId
      )
        throw new HttpError(403, "This vendor account is not active.");
    }
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
    const capability = commandCapabilities[name];
    if (!isTestBuyer(user) && (capability || user.role))
      await writeAudit(db, {
        actor: user.email,
        action: name,
        record: String(args[0] && typeof args[0] === "string" ? args[0] : ""),
        capability,
        source:
          user.role === "Vendor" ? "vendor" : user.role ? "admin" : "customer",
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
      recentlyViewed: a.recentlyViewed,
    },
    user.id,
  );
}
async function validLine(
  db: Queryable,
  user: Viewer,
  pid: unknown,
  vid: unknown,
  qty: unknown,
): Promise<CartLine> {
  const p = await required<Product>(db, productRecordKind(user), pid);
  const variant = p.variants.find((v) => v.id === vid);
  const category = await record<{ active?: boolean; restricted: boolean }>(
    db,
    "categories",
    p.categorySlug,
  );
  if (!variant || !isPurchasableVariant(p, category, variant))
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
    "recordProductView",
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
        user,
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
        await validLine(db, user, a, b, line.quantity);
        if (index < 0) state.cart.push(line);
        else
          state.cart[index].quantity = s.quantity.parse(
            state.cart[index].quantity + line.quantity,
          );
        state.savedForLater = state.savedForLater.filter((l) => l !== line);
      }
    } else if (name === "toggleWishlist") {
      const p = await required<Product>(db, productRecordKind(user), a);
      const category = await record<{ active?: boolean; restricted: boolean }>(
        db,
        "categories",
        p.categorySlug,
      );
      if (!isCustomerVisibleProduct(p, category))
        throw new HttpError(404, "Product not found.");
      state.wishlist = state.wishlist.includes(p.id)
        ? state.wishlist.filter((id) => id !== p.id)
        : [...state.wishlist, p.id];
    } else if (name === "recordProductView") {
      const p = await required<Product>(db, productRecordKind(user), a);
      const category = await record<{ active?: boolean; restricted: boolean }>(
        db,
        "categories",
        p.categorySlug,
      );
      if (!isCustomerVisibleProduct(p, category))
        throw new HttpError(404, "Product not found.");
      state.recentlyViewed = [
        p.id,
        ...state.recentlyViewed.filter((id) => id !== p.id),
      ].slice(0, 20);
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
    const editingAnotherCustomer = a !== user.id;
    const patch = z
      .object({
        name: s.short.optional(),
        phone: s.text.optional(),
        city: s.text.optional(),
        state: s.text.optional(),
        notes: s.text.optional(),
        email: z.email().optional(),
        tags: z.array(s.short).max(30).optional(),
        segments: z.array(s.short).max(30).optional(),
        lifecycleStage: z
          .enum(["new", "active", "at_risk", "inactive", "vip"])
          .optional(),
        marketingConsent: z.boolean().optional(),
      })
      .parse(b);
    const profileManagement = Object.keys(patch).some((key) => key !== "notes");
    if (editingAnotherCustomer)
      requireCapability(
        user,
        profileManagement ? "customers.manage" : "customers.support-note",
      );
    if (a === user.id && patch.email && patch.email !== user.email)
      throw new HttpError(
        400,
        "Email changes require verification and cannot be made here.",
      );
    if (!user.role) delete patch.notes;
    const before = await record<Record<string, unknown>>(
      db,
      "customers",
      s.id.parse(a),
    );
    const after = {
      ...before,
      ...patch,
      id: a,
    };
    await put(db, "customers", s.id.parse(a), after, s.id.parse(a));
    if (a === user.id && patch.name)
      await db.query('UPDATE "user" SET name=$1 WHERE id=$2', [
        patch.name,
        user.id,
      ]);
    if (editingAnotherCustomer)
      await writeAudit(db, {
        actor: user.email,
        action: "customers.profile-update",
        record: String(a),
        capability: profileManagement
          ? "customers.manage"
          : "customers.support-note",
        source: "admin",
        before,
        after,
      });
    return null;
  }
  if (name === "mergeCustomers") {
    requireCapability(user, "customers.merge");
    const input = z.object({ primaryId: s.id, secondaryId: s.id }).parse(a);
    if (input.primaryId === input.secondaryId)
      throw new HttpError(400, "Choose two different customers.");
    const primary = await required<Record<string, unknown>>(
      db,
      "customers",
      input.primaryId,
    );
    const secondary = await required<Record<string, unknown>>(
      db,
      "customers",
      input.secondaryId,
    );
    const mergedTags = Array.from(
      new Set([
        ...((primary.tags as string[]) ?? []),
        ...((secondary.tags as string[]) ?? []),
      ]),
    );
    const mergedSegments = Array.from(
      new Set([
        ...((primary.segments as string[]) ?? []),
        ...((secondary.segments as string[]) ?? []),
      ]),
    );
    await put(db, "customers", input.primaryId, {
      ...primary,
      tags: mergedTags,
      segments: mergedSegments,
      notes: [primary.notes, secondary.notes]
        .filter(Boolean)
        .join("\\n--- merged ---\\n"),
      id: input.primaryId,
    });
    // Reassign orders and returns to the primary customer.
    const orders = await records<Record<string, unknown>>(db, "orders");
    for (const order of orders) {
      if (order.customerId === input.secondaryId) {
        await put(db, "orders", String(order.id), {
          ...order,
          customerId: input.primaryId,
        });
      }
    }
    const returns = await records<Record<string, unknown>>(db, "returns");
    for (const item of returns) {
      if (item.customerId === input.secondaryId) {
        await put(db, "returns", String(item.id), {
          ...item,
          customerId: input.primaryId,
        });
      }
    }
    const sourcing = await records<Record<string, unknown>>(db, "sourcing");
    for (const item of sourcing) {
      if (item.customerId === input.secondaryId) {
        await put(
          db,
          "sourcing",
          String(item.id),
          {
            ...item,
            customerId: input.primaryId,
          },
          input.primaryId,
        );
      }
    }
    await db.query("UPDATE support_thread SET owner_id=$2 WHERE owner_id=$1", [
      input.secondaryId,
      input.primaryId,
    ]);
    await db.query(
      "DELETE FROM commerce_record WHERE kind='customers' AND id=$1",
      [input.secondaryId],
    );
    await writeAudit(db, {
      actor: user.email,
      action: "customers.merge",
      record: input.primaryId,
      capability: "customers.merge",
      source: "admin",
      after: { secondaryId: input.secondaryId },
    });
    return { merged: true };
  }
  if (name === "deleteCustomer") {
    requireCapability(user, "customers.delete");
    const id = s.id.parse(a);
    const existing = await required<Record<string, unknown>>(
      db,
      "customers",
      id,
    );
    const redacted = {
      ...existing,
      name: "Deleted customer",
      email: `deleted+${id}@privacy.invalid`,
      phone: "",
      city: "",
      state: "",
      notes: "Profile anonymized through the privacy workflow.",
      tags: ["privacy-erased"],
      segments: [],
      lifecycleStage: "inactive",
      marketingConsent: false,
    };
    await put(db, "customers", id, redacted, id);
    const orders = await records<Record<string, unknown>>(db, "orders");
    for (const order of orders) {
      if (order.customerId !== id) continue;
      await put(
        db,
        "orders",
        String(order.id),
        {
          ...order,
          customerName: "Deleted customer",
          customerEmail: redacted.email,
          customerPhone: "",
        },
        id,
      );
    }
    await db.query(
      "UPDATE support_thread SET email=$2,subject='Privacy-redacted support request' WHERE owner_id=$1",
      [id, redacted.email],
    );
    await writeAudit(db, {
      actor: user.email,
      action: "customers.anonymize",
      record: id,
      capability: "customers.delete",
      source: "admin",
      before: existing,
      after: redacted,
    });
    return { anonymized: true };
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
    const duplicates = await db.query(
      `SELECT data->>'reference' AS reference
       FROM commerce_record
       WHERE kind=$1 AND owner_id=$2
         AND lower(data->>'productName')=lower($3)
         AND data->>'status' NOT IN ('converted','cancelled','declined')
         AND updated_at > now() - interval '24 hours'
       ORDER BY updated_at DESC LIMIT 1`,
      [scopedRecordKind(user, "sourcing"), user.id, value.productName],
    );
    if (duplicates.rows[0])
      throw new HttpError(
        409,
        `A similar open request (${duplicates.rows[0].reference}) was submitted in the last 24 hours. Open it instead of creating a duplicate.`,
      );
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
    const requestKind = scopedRecordKind(user, "sourcing");
    await put(db, requestKind, requestId, request, user.id);
    const acc = await account(db, user);
    acc.lastSourcingReference = reference;
    await saveAccount(db, user, acc);
    if (!isTestBuyer(user)) {
      await enqueueMail(db, {
        eventKey: `sourcing:${requestId}:received:customer`,
        eventType: "sourcing.received",
        recipient: user.email,
        template: "sourcing.received",
        data: { reference, requestId },
      });
      await enqueueOperationsAlert(db, {
        eventKey: `sourcing:${requestId}:received`,
        eventType: "sourcing.received",
        title: "New sourcing request",
        message: `${user.name} submitted sourcing request ${reference}.`,
        href: `/admin/sourcing-requests/${requestId}`,
      });
    }
    await enqueueViewerNotification(db, user, {
      eventKey: `sourcing:${requestId}:received`,
      type: "sourcing.received",
      title: "Sourcing request received",
      body: `${reference} is ready for review by our sourcing team.`,
      href: `/account/sourcing-requests/${requestId}`,
    });
    return reference;
  }
  if (name === "respondToQuote") {
    const request = await required<SourcingRequest>(
      db,
      scopedRecordKind(user, "sourcing"),
      a,
    );
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
    await put(
      db,
      scopedRecordKind(user, "sourcing"),
      request.id,
      request,
      user.id,
    );
    return null;
  }
  if (name === "createReturn") {
    const value = z
      .object({
        orderId: s.id,
        lineId: s.id,
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
    const order = await required<Order>(
      db,
      scopedRecordKind(user, "orders"),
      value.orderId,
    );
    own(order.customerId, user);
    if (
      order.paymentStatus !== "paid" ||
      order.fulfillmentStatus !== "delivered"
    )
      throw new HttpError(
        409,
        "Returns are available for paid, delivered orders.",
      );
    const item = findOrderLine(order, value.lineId);
    const returnKind = scopedRecordKind(user, "returns");
    const returns = await records<ReturnRequest>(db, returnKind, user.id);
    const requested = returns
      .filter(
        (r) =>
          r.orderId === order.id &&
          r.lineId === value.lineId &&
          r.status !== "rejected",
      )
      .reduce((sum, r) => sum + r.quantity, 0);
    if (!item || value.quantity + requested > item.quantity)
      throw new HttpError(
        400,
        "The return quantity exceeds the purchased quantity.",
      );
    const id = randomUUID();
    const result: ReturnRequest = {
      ...value,
      id,
      reference: `RT-${id.slice(0, 8)}`,
      customerId: user.id,
      productId: item.productId,
      productName: item.name,
      variantId: item.variantId,
      variantLabel: item.variantLabel,
      sku: item.sku,
      status: "requested",
      createdAt: new Date().toISOString(),
      adminNote: "",
    };
    await put(db, returnKind, id, result, user.id);
    if (!isTestBuyer(user)) {
      await enqueueMail(db, {
        eventKey: `return:${id}:received:customer`,
        eventType: "return.received",
        recipient: user.email,
        template: "return.received",
        data: { reference: result.reference },
      });
      await enqueueOperationsAlert(db, {
        eventKey: `return:${id}:received`,
        eventType: "return.received",
        title: "New return request",
        message: `${user.name} submitted return ${result.reference} for order ${order.reference}.`,
        href: "/admin/returns",
      });
    }
    await enqueueViewerNotification(db, user, {
      eventKey: `return:${id}:received`,
      type: "return.received",
      title: "Return request received",
      body: `${result.reference} is awaiting review.`,
      href: "/account/returns",
    });
    return result;
  }
  if (name === "cancelOrder") {
    const orderKind = scopedRecordKind(user, "orders");
    const order = await required<Order>(db, orderKind, a);
    if (order.customerId !== user.id) requireCapability(user, "orders.fulfil");
    if (
      order.paymentStatus !== "pending" ||
      order.fulfillmentStatus !== "awaiting_payment"
    )
      throw new HttpError(
        409,
        "Contact support to cancel or refund an order after payment.",
      );
    const payment = isTestBuyer(user)
      ? { rows: [] }
      : await db.query("SELECT reference FROM payment WHERE order_id=$1", [
          order.id,
        ]);
    if (payment.rows.length)
      throw new HttpError(
        409,
        "A payment is in progress. Contact support for cancellation.",
      );
    order.fulfillmentStatus = "cancelled";
    await put(db, orderKind, order.id, order, order.customerId);
    return null;
  }
  if (name === "resetTestData") {
    if (!isTestBuyer(user))
      throw new HttpError(
        403,
        "This action is available only in the test account.",
      );
    await db.query(
      `DELETE FROM commerce_record
       WHERE (kind='testSeedVersions' AND id=$1)
          OR (owner_id=$1 AND kind IN ('testProducts','testVendors','testOrders','testSourcing','testReturns','testShippingZones','testNotifications'))`,
      [user.id],
    );
    await db.query(
      "DELETE FROM support_thread WHERE owner_id=$1 AND test_scope=true",
      [user.id],
    );
    await put(
      db,
      "accounts",
      user.id,
      {
        cart: [],
        wishlist: [],
        savedForLater: [],
        addresses: [],
        recentlyViewed: [],
        location: { state: "Lagos", city: "Ikeja" },
      },
      user.id,
    );
    return { reset: true };
  }
  const vendorCommands = new Set(["saveVendorProduct", "saveVendorStock"]);
  if (vendorCommands.has(name)) {
    if (user.role !== "Vendor")
      throw new HttpError(403, "Vendor portal access is required.");
  } else {
    const capability = commandCapabilities[name];
    if (!capability) throw new HttpError(400, "Unknown action.");
    requireCapability(user, capability);
  }
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
    if (value.status === "published") {
      const readiness = await publishReadiness(db, value);
      if (!readiness.ready)
        throw new HttpError(409, readiness.issues.join(" "));
    }
    if (new Set(value.variants.map((v) => v.id)).size !== value.variants.length)
      throw new HttpError(400, "Variant IDs must be unique.");
    const allSkus = [
      value.sku.toLowerCase(),
      ...value.variants.map((variant) => variant.sku.toLowerCase()),
    ];
    if (new Set(allSkus).size !== allSkus.length)
      throw new HttpError(400, "Product and variant SKUs must be unique.");
    const duplicateSlug = await db.query(
      `SELECT id FROM commerce_record
       WHERE kind='products' AND id<>$1 AND lower(data->>'slug')=lower($2)
       LIMIT 1`,
      [value.id, value.slug],
    );
    if (duplicateSlug.rows.length)
      throw new HttpError(409, "Another product already uses this URL slug.");
    const duplicateSku = await db.query(
      `SELECT id FROM commerce_record
       WHERE kind='products' AND id<>$1
         AND (
           lower(data->>'sku') = ANY($2::text[]) OR
           EXISTS (
             SELECT 1
             FROM jsonb_array_elements(COALESCE(data->'variants','[]'::jsonb)) variant
             WHERE lower(variant->>'sku') = ANY($2::text[])
           )
         )
       LIMIT 1`,
      [value.id, allSkus],
    );
    if (duplicateSku.rows.length)
      throw new HttpError(409, "A product or variant already uses this SKU.");
    if (
      value.subcategorySlug &&
      !(
        await record<{ subcategories?: Array<{ slug: string }> }>(
          db,
          "categories",
          value.categorySlug,
        )
      )?.subcategories?.some((item) => item.slug === value.subcategorySlug)
    )
      throw new HttpError(400, "Select a subcategory from this department.");
    await put(db, "products", value.id, {
      ...value,
      updatedAt: new Date().toISOString(),
    });
  } else if (name === "bulkProductStatus") {
    const input = z
      .object({
        ids: z.array(s.id).min(1).max(200),
        status: s.product.shape.status,
      })
      .parse(a);
    for (const id of input.ids) {
      const product = await required<Product>(db, "products", id);
      if (input.status === "published") {
        const readiness = await publishReadiness(db, product);
        if (!readiness.ready)
          throw new HttpError(
            409,
            product.name + ": " + readiness.issues.join(" "),
          );
      }
      await put(db, "products", id, {
        ...product,
        status: input.status,
        updatedAt: new Date().toISOString(),
      });
      await put(db, "productMeta", "schedule:" + id, {
        id: "schedule:" + id,
        productId: id,
        status: "cancelled",
      });
    }
    return { updated: input.ids.length };
  } else if (name === "duplicateProduct") {
    const source = await required<Product>(db, "products", s.id.parse(a));
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const slug = source.slug + "-copy-" + suffix.toLowerCase();
    const sku = source.sku + "-COPY-" + suffix;
    const copy = s.product.parse({
      ...source,
      id: randomUUID(),
      slug,
      sku,
      name: source.name + " (copy)",
      status: "draft",
      featured: false,
      newArrival: false,
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variants: source.variants.map((variant) => ({
        ...variant,
        id: randomUUID(),
        sku: variant.sku + "-COPY-" + suffix,
      })),
    });
    await put(db, "products", copy.id, copy);
    return { id: copy.id, name: copy.name };
  } else if (name === "bulkReassignProducts") {
    const input = z
      .object({
        ids: z.array(s.id).min(1).max(200),
        vendorId: s.id.optional(),
        categorySlug: s.id.optional(),
      })
      .parse(a);
    if (input.vendorId && !(await record(db, "vendors", input.vendorId)))
      throw new HttpError(400, "Select an existing supplier.");
    if (
      input.categorySlug &&
      !(await record(db, "categories", input.categorySlug))
    )
      throw new HttpError(400, "Select an existing department.");
    for (const id of input.ids) {
      const product = await required<Product>(db, "products", id);
      await put(db, "products", id, {
        ...product,
        vendorId: input.vendorId ?? product.vendorId,
        categorySlug: input.categorySlug ?? product.categorySlug,
        status: "draft",
        updatedAt: new Date().toISOString(),
      });
    }
    return { updated: input.ids.length };
  } else if (name === "importProducts") {
    const entries = z
      .array(
        z.object({
          name: s.short,
          sku: s.short,
          price: s.amount,
          costPrice: s.amount,
          categorySlug: s.id,
          vendorId: s.id,
          description: s.text.optional(),
          brand: s.short.optional(),
        }),
      )
      .min(1)
      .max(200)
      .parse(a);
    const imported: string[] = [];
    for (const entry of entries) {
      if (
        !(await record(db, "categories", entry.categorySlug)) ||
        !(await record(db, "vendors", entry.vendorId))
      )
        throw new HttpError(
          400,
          entry.name + ": category or supplier does not exist.",
        );
      const suffix = randomUUID().slice(0, 6).toUpperCase();
      const base = entry.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120);
      const now = new Date().toISOString();
      const value = s.product.parse({
        id: randomUUID(),
        slug: (base || "product") + "-" + suffix.toLowerCase(),
        sku: entry.sku + "-" + suffix,
        name: entry.name,
        categorySlug: entry.categorySlug,
        brand: entry.brand ?? "PAYDAN",
        images: [
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
        ],
        description: entry.description || "Product details will be added soon.",
        highlights: [],
        specifications: {},
        price: entry.price,
        costPrice: entry.costPrice,
        availability: "in_stock",
        vendorId: entry.vendorId,
        variants: [
          {
            id: "default-" + suffix.toLowerCase(),
            sku: entry.sku + "-DEFAULT-" + suffix,
            label: "Standard",
            options: {},
            price: entry.price,
            availability: "in_stock",
          },
        ],
        status: "draft",
        featured: false,
        newArrival: false,
        restricted: false,
        rating: 0,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      await put(db, "products", value.id, value);
      imported.push(value.id);
    }
    return { imported: imported.length, ids: imported };
  } else if (name === "scheduleProductPublish") {
    const parsed = z
      .union([
        z.tuple([s.id, z.iso.datetime()]),
        z.object({ id: s.id, publishAt: z.iso.datetime() }),
      ])
      .parse(a);
    const input = Array.isArray(parsed)
      ? { id: parsed[0], publishAt: parsed[1] }
      : parsed;
    const product = await required<Product>(db, "products", input.id);
    if (Date.parse(input.publishAt) <= Date.now())
      throw new HttpError(400, "Choose a future publish time.");
    await put(db, "productMeta", "schedule:" + product.id, {
      id: "schedule:" + product.id,
      productId: product.id,
      publishAt: input.publishAt,
      status: "scheduled",
      updatedAt: new Date().toISOString(),
    });
    return { scheduled: true, publishAt: input.publishAt };
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
    const status = s.product.shape.status.parse(b);
    if (status !== value.status) {
      await put(db, "productMeta", "schedule:" + value.id, {
        id: "schedule:" + value.id,
        productId: value.id,
        status: "cancelled",
      });
    }
    if (status === "published") {
      const readiness = await publishReadiness(db, value);
      if (!readiness.ready)
        throw new HttpError(409, readiness.issues.join(" "));
    }
    value.status = status;
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
    if (!prior && value.role === "Vendor")
      throw new HttpError(
        400,
        "Create vendor access from the supplier record so it is scoped correctly.",
      );
    if (prior?.role !== "Vendor" && value.role === "Vendor")
      throw new HttpError(
        400,
        "Create vendor access from the supplier record so it is scoped correctly.",
      );
    if (prior?.role === "Vendor") {
      if (value.role !== "Vendor")
        throw new HttpError(
          400,
          "Unlink vendor access from the supplier record before changing its role.",
        );
      if (value.email !== prior.email)
        throw new HttpError(
          400,
          "Change the linked email from the supplier record.",
        );
    }
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
      await enqueueMail(db, {
        eventKey: `team:${id}:invite:${value.email}`,
        eventType: "team.invited",
        recipient: value.email,
        template: "team.invite",
        data: {
          url: new URL(
            `/register?email=${encodeURIComponent(value.email)}`,
            `${(process.env.BETTER_AUTH_URL || "https://paydan.store").replace(/\/+$/, "")}/`,
          ).toString(),
        },
      });
  } else if (name === "createVendorAccount") {
    const input = z
      .object({ vendorId: s.id, name: s.short, email: z.email() })
      .parse(a);
    const email = input.email.toLowerCase();
    const vendor = await record<Vendor>(db, "vendors", input.vendorId);
    if (!vendor || vendor.status !== "active")
      throw new HttpError(400, "Choose an active supplier.");
    const team = await records<TeamMember>(db, "team");
    if (team.some((member) => member.email.toLowerCase() === email))
      throw new HttpError(409, "An access record already uses this email.");
    if (
      vendor.ownerTeamMemberId ||
      team.some((member) => member.vendorId === vendor.id)
    )
      throw new HttpError(
        409,
        "This supplier already has linked portal access.",
      );
    const id = randomUUID();
    const member: TeamMember = {
      id,
      name: input.name,
      email,
      role: "Vendor",
      vendorId: vendor.id,
      status: "invited",
      lastActive: "",
    };
    await put(db, "team", id, member);
    await put(db, "vendors", vendor.id, {
      ...vendor,
      ownerTeamMemberId: id,
    });
    const invite = await issueVendorInvite(db, member, vendor);
    await enqueueMail(db, {
      eventKey: invite.eventKey,
      eventType: "vendor.invited",
      recipient: email,
      template: "vendor.invite",
      data: {
        url: invite.url,
        message:
          "PAYDAN has prepared vendor access for " +
          vendor.name +
          ". Open the secure setup link with " +
          email +
          ", create your password, verify your email, then sign in to the vendor portal.",
      },
    });
    return { id, email };
  } else if (name === "updateVendorAccount") {
    const input = z
      .object({
        id: s.id,
        status: s.team.shape.status.optional(),
        email: z.email().optional(),
        resend: z.boolean().optional(),
      })
      .parse(a);
    const member = await required<TeamMember>(db, "team", input.id);
    if (member.role !== "Vendor")
      throw new HttpError(400, "This access record is not a vendor account.");
    const email = input.email?.toLowerCase() ?? member.email;
    if (email !== member.email) {
      const team = await records<TeamMember>(db, "team");
      if (
        team.some(
          (item) => item.id !== member.id && item.email.toLowerCase() === email,
        )
      )
        throw new HttpError(
          409,
          "Another access record already uses this email.",
        );
    }
    if (
      member.status === "suspended" &&
      (input.resend || email !== member.email)
    )
      throw new HttpError(
        409,
        "Reactivate this vendor before changing or resending access.",
      );
    const updated: TeamMember = {
      ...member,
      email,
      status:
        email !== member.email ? "invited" : (input.status ?? member.status),
    };
    await put(db, "team", updated.id, updated);
    if (input.resend || email !== member.email) {
      const vendor = updated.vendorId
        ? await record<Vendor>(db, "vendors", updated.vendorId)
        : undefined;
      if (!vendor)
        throw new HttpError(
          400,
          "This vendor account is not linked to a supplier.",
        );
      const invite = await issueVendorInvite(db, updated, vendor);
      await enqueueMail(db, {
        eventKey: invite.eventKey,
        eventType: "vendor.invited",
        recipient: email,
        template: "vendor.invite",
        data: {
          url: invite.url,
          message:
            "Your PAYDAN vendor portal access was updated. Open the secure setup link for " +
            email +
            " to finish registration.",
        },
      });
    }
    return { id: updated.id, email };
  } else if (name === "unlinkVendorAccount") {
    const id = s.id.parse(a);
    const member = await required<TeamMember>(db, "team", id);
    if (member.role !== "Vendor")
      throw new HttpError(400, "This access record is not a vendor account.");
    if (member.vendorId) {
      const vendor = await record<Vendor>(db, "vendors", member.vendorId);
      if (vendor?.ownerTeamMemberId === member.id)
        await put(db, "vendors", vendor.id, {
          ...vendor,
          ownerTeamMemberId: undefined,
        });
    }
    await revokeVendorInvites(db, member.id);
    await put(db, "team", member.id, {
      ...member,
      vendorId: undefined,
      status: "suspended",
    });
    return { id: member.id };
  } else if (name === "saveVendorProduct") {
    const vendorId = requireVendor(user);
    const product = await required<Product>(
      db,
      "products",
      z.object({ id: s.id }).parse(a).id,
    );
    if (product.vendorId !== vendorId)
      throw new HttpError(404, "Product not found.");
    const patch = z
      .object({
        name: s.short.optional(),
        description: s.text.optional(),
        images: z.array(s.image).max(12).optional(),
        imageAlts: z.record(z.string(), s.short).optional(),
        highlights: z.array(s.short).max(20).optional(),
        specifications: z.record(z.string(), s.short).optional(),
      })
      .parse(b);
    const updated = {
      ...product,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await put(db, "products", product.id, updated);
    return { id: product.id };
  } else if (name === "saveVendorStock") {
    const vendorId = requireVendor(user);
    const input = z
      .object({
        productId: s.id,
        variantId: s.id,
        available: z.number().int().min(0).max(1000000),
      })
      .parse(a);
    const product = await required<Product>(db, "products", input.productId);
    if (product.vendorId !== vendorId)
      throw new HttpError(404, "Product not found.");
    if (!product.variants.some((variant) => variant.id === input.variantId))
      throw new HttpError(404, "Variant not found.");
    await db.query(
      "INSERT INTO inventory(product_id,variant_id,available) VALUES($1,$2,$3) ON CONFLICT(product_id,variant_id) DO UPDATE SET available=excluded.available,updated_at=now()",
      [input.productId, input.variantId, input.available],
    );
    return { saved: true };
  } else if (name === "adjustStock") {
    const input = z
      .object({
        productId: s.id,
        variantId: s.id,
        available: z.number().int().min(0).max(1000000),
        reason: z.string().trim().min(3).max(200),
      })
      .parse(a);
    const product = await required<Product>(db, "products", input.productId);
    if (!product.variants.some((variant) => variant.id === input.variantId))
      throw new HttpError(404, "Variant not found.");
    const prior = await db.query(
      "SELECT available FROM inventory WHERE product_id=$1 AND variant_id=$2",
      [input.productId, input.variantId],
    );
    const before = Number(prior.rows[0]?.available ?? 0);
    await db.query(
      "INSERT INTO inventory(product_id,variant_id,available) VALUES($1,$2,$3) ON CONFLICT(product_id,variant_id) DO UPDATE SET available=excluded.available,updated_at=now()",
      [input.productId, input.variantId, input.available],
    );
    const movement = {
      id: randomUUID(),
      productId: input.productId,
      variantId: input.variantId,
      before,
      after: input.available,
      delta: input.available - before,
      reason: input.reason,
      actor: user.email,
      createdAt: new Date().toISOString(),
    };
    await put(db, "stockMovements", movement.id, movement, user.id);
    return movement;
  } else if (name === "updateSettings") {
    const patch = z
      .object({
        storeName: s.short,
        supportEmail: z.email(),
        supportPhone: z
          .string()
          .trim()
          .regex(/^\+?[0-9 ()-]{7,25}$/, "Enter a valid support phone number."),
        businessHours: s.short,
        announcement: s.text,
        orderNotificationEmail: z.union([z.literal(""), z.email()]),
        supportNotificationEmail: z.union([z.literal(""), z.email()]),
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
    await enqueueMail(db, {
      eventKey: `order:${order.id}:status:${order.fulfillmentStatus}:customer`,
      eventType: "order.status_changed",
      recipient: order.customerEmail,
      template: "order.status",
      data: {
        reference: order.reference,
        orderId: order.id,
        status: order.fulfillmentStatus,
      },
    });
    await enqueueNotification(db, {
      ownerId: order.customerId,
      eventKey: `order:${order.id}:status:${order.fulfillmentStatus}`,
      type: "order.status_changed",
      title: "Order status updated",
      body: `${order.reference} is now ${order.fulfillmentStatus.replaceAll("_", " ")}.`,
      href: `/account/orders/${order.id}`,
    });
  } else if (name === "bulkShipOrders") {
    const input = z
      .object({
        ids: z.array(s.id).min(1).max(100),
        trackingCode: z.string().trim().min(3).max(150),
      })
      .parse(a);
    const transitions: Record<string, string[]> = {
      processing: ["sourcing", "partially_packed", "dispatched"],
      sourcing: ["processing", "partially_packed"],
      partially_packed: ["dispatched"],
      dispatched: ["delivered"],
      delivered: [],
      cancelled: [],
    };
    for (const id of input.ids) {
      const order = await required<Order>(db, "orders", id);
      if (order.paymentStatus !== "paid")
        throw new HttpError(409, order.reference + " is not paid.");
      if (!transitions[order.fulfillmentStatus]?.includes("dispatched"))
        throw new HttpError(
          409,
          order.reference + " cannot move to dispatched.",
        );
      order.fulfillmentStatus = "dispatched";
      order.trackingCode = input.trackingCode;
      order.timeline.push({
        label: "dispatched",
        at: new Date().toISOString(),
        done: true,
        note: "Tracking " + input.trackingCode,
      });
      await put(db, "orders", order.id, order, order.customerId);
      await enqueueMail(db, {
        eventKey: "order:" + order.id + ":tracking:" + input.trackingCode,
        eventType: "order.status_changed",
        recipient: order.customerEmail,
        template: "order.status",
        data: {
          reference: order.reference,
          orderId: order.id,
          status: "dispatched",
        },
      });
    }
    return { shipped: input.ids.length };
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
    const nextStage = z
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
    const details =
      typeof d === "string"
        ? { notes: s.text.parse(d) }
        : z
            .object({
              notes: s.text.optional(),
              assignee: s.text.optional(),
              eta: s.text.optional(),
              purchaseOrderRef: s.text.optional(),
              evidenceUrls: z.array(s.image).max(20).optional(),
              stageReason: s.text.optional(),
              urgent: z.boolean().optional(),
            })
            .parse(d ?? {});
    const priorStage = group.stage;
    group.stage = nextStage;
    Object.assign(group, details);
    if (nextStage !== priorStage && !details.stageReason)
      group.stageReason = `Stage changed from ${priorStage.replaceAll("_", " ")} to ${nextStage.replaceAll("_", " ")}.`;
    group.updatedAt = new Date().toISOString();
    await put(db, "orders", order.id, order, order.customerId);
  } else if (name === "bulkUpdateVendorStages") {
    const input = z
      .object({
        groups: z
          .array(z.object({ orderId: s.id, groupId: s.id }))
          .min(1)
          .max(100),
        stage: z.enum([
          "awaiting_assignment",
          "contact_vendor",
          "awaiting_confirmation",
          "ordered_from_supplier",
          "supplier_fulfilled",
          "ready_for_dispatch",
          "blocked",
          "closed",
        ]),
        reason: s.short,
      })
      .parse(a);
    for (const target of input.groups) {
      const order = await required<Order>(db, "orders", target.orderId);
      const group = order.vendorGroups.find(
        (item) => item.id === target.groupId,
      );
      if (!group) throw new HttpError(404, "Supplier group not found.");
      if (
        [
          "ordered_from_supplier",
          "supplier_fulfilled",
          "ready_for_dispatch",
          "closed",
        ].includes(input.stage) &&
        order.paymentStatus !== "paid"
      )
        throw new HttpError(
          409,
          `Verify payment on ${order.reference} before moving its supplier work.`,
        );
      group.stage = input.stage;
      group.stageReason = input.reason;
      group.updatedAt = new Date().toISOString();
      await put(db, "orders", order.id, order, order.customerId);
    }
    return { updated: input.groups.length };
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
    const returnOrder = await record<Order>(db, "orders", value.orderId);
    if (returnOrder)
      await enqueueMail(db, {
        eventKey: `return:${value.id}:status:${value.status}:customer`,
        eventType: "return.status_changed",
        recipient: returnOrder.customerEmail,
        template: "return.status",
        data: { reference: value.reference, status: value.status },
      });
    await enqueueNotification(db, {
      ownerId: value.customerId,
      eventKey: `return:${value.id}:status:${value.status}`,
      type: "return.status_changed",
      title: "Return status updated",
      body: `${value.reference} is now ${value.status.replaceAll("_", " ")}.`,
      href: "/account/returns",
    });
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
      if (request.quote) {
        request.quoteHistory = [
          ...(request.quoteHistory ?? []),
          structuredClone(request.quote),
        ].slice(-20);
      }
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
      if (request.quote.total > 1_000_000 && user.role !== "Super Admin")
        throw new HttpError(
          403,
          "Quotes above NGN 1,000,000 require a Super Admin to send them.",
        );
      request.quote.status = "sent";
      request.quote.sentAt = new Date().toISOString();
      request.status = "awaiting_customer";
      await enqueueMail(db, {
        eventKey: `sourcing:${request.id}:quote:${request.quote.sentAt}:customer`,
        eventType: "sourcing.quote_sent",
        recipient: request.email,
        template: "sourcing.quote",
        data: {
          reference: request.reference,
          requestId: request.id,
          validUntil: request.quote.validUntil,
        },
      });
      if (request.customerId)
        await enqueueNotification(db, {
          ownerId: request.customerId,
          eventKey: `sourcing:${request.id}:quote:${request.quote.sentAt}`,
          type: "sourcing.quote_sent",
          title: "Your sourcing quote is ready",
          body: `${request.reference} is waiting for your response.`,
          href: `/account/sourcing-requests/${request.id}`,
        });
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
          lineId: randomUUID(),
          productId: `${request.id}-${l.id}`,
          variantId: l.id,
          sku: `SOURCED-${request.reference}-${l.id}`,
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
