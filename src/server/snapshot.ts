import "server-only";
import { emptyState } from "@/lib/empty-state";
import { toPublicProduct, toMemberProduct } from "@/lib/catalog-dto";
import type {
  DemoState,
  Order,
  Product,
  SourcingRequest,
  Vendor,
} from "@/lib/types";
import {
  isCustomerVisibleCategory,
  isCustomerVisibleProduct,
} from "@/lib/catalog-visibility";
import { normalizedOrderItems } from "@/lib/order-lines";
import { database, records, record } from "./db";
import type { Viewer } from "./http";
import { isTestBuyer } from "./test-buyer";
import { notificationsFor, testNotificationsFor } from "./notifications";
import { hasCapability, type AdminCapability } from "@/lib/capabilities";
import { productLocation, proximityLabel } from "@/lib/fulfillment";

export function customerOrder(order: Order) {
  const items = normalizedOrderItems(order);
  return {
    ...order,
    items: items.map(
      ({
        costPrice: _cost,
        vendorId: _vendor,
        fulfillmentLocationId: _location,
        ...item
      }) => item,
    ),
    shipments: order.vendorGroups.map((group, index) => ({
      id: group.id,
      label: group.originCity
        ? `Delivery from ${group.originCity}`
        : `Delivery group ${index + 1}`,
      status:
        group.stage === "closed"
          ? "Delivered"
          : group.stage === "ready_for_dispatch"
            ? "Ready for dispatch"
            : order.fulfillmentStatus === "dispatched"
              ? "Dispatched"
              : "Processing",
      eta: group.eta,
      originCity: group.originCity,
      originState: group.originState,
      deliveryFee: group.deliveryFee,
      items: group.items.map(
        ({
          costPrice: _cost,
          vendorId: _vendor,
          fulfillmentLocationId: _location,
          ...item
        }) => item,
      ),
    })),
    vendorGroups: [],
    notes: "",
    timeline: order.timeline.map(({ note: _note, ...event }) => event),
  };
}
export function customerRequest(request: SourcingRequest) {
  const { adminNotes: _notes, assignee: _assignee, ...safe } = request;
  if (safe.quote?.status === "draft") delete safe.quote;
  return safe;
}
export async function fixturePublicSnapshot(): Promise<DemoState> {
  const state = emptyState();
  const [{ products }, { categories }, { seedBanners }, { vendors }] =
    await Promise.all([
      import("@/data/products"),
      import("@/data/categories"),
      import("@/data/promotions"),
      import("@/data/vendors"),
    ]);
  const vendorNames = new Map(
    vendors.map((vendor) => [vendor.id, vendor.name]),
  );
  state.products = products
    .filter((product) => product.status === "published" && !product.restricted)
    .map((product) =>
      toPublicProduct({
        ...product,
        vendorName: vendorNames.get(product.vendorId),
      }),
    ) as unknown as Product[];
  state.categories = categories.filter(isCustomerVisibleCategory);
  state.banners = seedBanners;
  return state;
}
export async function snapshot(
  user: Viewer | null,
  admin = false,
): Promise<DemoState> {
  const state = emptyState();
  // A disconnected installation can still preview the approved public design.
  // The source fixtures are evaluated only on the server and never contain customer records here.
  if (!process.env.DATABASE_URL) return fixturePublicSnapshot();
  const db = database();
  const operations = admin && Boolean(user?.role);
  const [products, categories, banners, shippingZones, settings] =
    await Promise.all([
      records<Product>(db, "products"),
      records<DemoState["categories"][number]>(db, "categories"),
      records<DemoState["banners"][number]>(db, "banners"),
      records<DemoState["shippingZones"][number]>(db, "shippingZones"),
      record<Partial<DemoState["settings"]>>(db, "settings", "store"),
    ]);
  state.products = products;
  state.categories = categories;
  state.banners = banners;
  state.shippingZones = shippingZones;
  const testBuyer = isTestBuyer(user);
  state.dataScope = testBuyer ? "test" : "production";
  if (testBuyer && user) {
    state.products = await records(db, "testProducts", user.id);
    state.shippingZones = await records(db, "testShippingZones", user.id);
  }
  state.settings = {
    ...state.settings,
    ...settings,
    transferEnabled: false,
  };
  if (!operations || !hasCapability(user?.role, "settings.manage")) {
    const {
      orderNotificationEmail: _orderNotificationEmail,
      supportNotificationEmail: _supportNotificationEmail,
      ...publicSettings
    } = state.settings;
    state.settings = publicSettings;
  }
  if (!operations || user?.role === "Support") {
    const vendors = await records<Vendor>(db, "vendors");
    const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
    const categoryBySlug = new Map(
      state.categories.map((category) => [category.slug, category]),
    );
    state.categories = state.categories.filter(isCustomerVisibleCategory);
    state.products = state.products
      .filter((product) =>
        isCustomerVisibleProduct(
          product,
          categoryBySlug.get(product.categorySlug),
        ),
      )
      .map((product) => {
        const vendor = vendorsById.get(product.vendorId);
        const location = vendor ? productLocation(product, vendor) : undefined;
        return (user ? toMemberProduct : toPublicProduct)({
          ...product,
          vendorName: vendor?.name,
          fulfillment: location
            ? {
                city: location.city,
                state: location.state,
                proximity: proximityLabel(location, state.location),
                dispatchLeadTimeDays: location.dispatchLeadTimeDays,
                pickupAvailable: location.pickupAvailable,
              }
            : undefined,
        });
      }) as unknown as Product[];
    state.banners = state.banners.filter(
      (b) =>
        b.active &&
        (!b.startAt || Date.parse(b.startAt) <= Date.now()) &&
        (!b.endAt || Date.parse(b.endAt) >= Date.now()),
    );
  }
  if (!user) state.shippingZones = [];
  if (user) {
    state.customerSession = { id: user.id, name: user.name, email: user.email };
    const [account, orders, sourcing, returns, notifications, profile] =
      await Promise.all([
        record<Partial<DemoState>>(db, "accounts", user.id),
        records<Order>(db, testBuyer ? "testOrders" : "orders", user.id),
        records<SourcingRequest>(
          db,
          testBuyer ? "testSourcing" : "sourcing",
          user.id,
        ),
        records<DemoState["returns"][number]>(
          db,
          testBuyer ? "testReturns" : "returns",
          user.id,
        ),
        testBuyer
          ? testNotificationsFor(db, user.id)
          : notificationsFor(db, user.id),
        record<{
          phone?: string;
          city?: string;
          state?: string;
          tags?: string[];
          marketingConsent?: boolean;
        }>(db, "customers", user.id),
      ]);
    for (const key of [
      "cart",
      "wishlist",
      "savedForLater",
      "addresses",
      "location",
      "lastOrderId",
      "lastSourcingReference",
      "recentlyViewed",
    ] as const) {
      if (account?.[key] !== undefined)
        Object.assign(state, { [key]: account[key] });
    }
    state.orders = orders.map(customerOrder) as unknown as Order[];
    state.sourcing = sourcing.map(customerRequest) as SourcingRequest[];
    state.returns = returns;
    state.notifications = notifications;
    state.customers = [
      {
        id: user.id,
        name: user.name,
        email: user.email,
        joinedAt: "",
        segments: [],
        tags: profile?.tags ?? [],
        marketingConsent: profile?.marketingConsent ?? false,
        notes: "",
        phone: profile?.phone ?? "",
        city: profile?.city ?? state.location.city,
        state: profile?.state ?? state.location.state,
      },
    ];
    if (operations) {
      state.adminSession = { id: user.id, name: user.name, role: user.role! };
      const recordCapabilities: Array<
        readonly [keyof DemoState, string, AdminCapability]
      > = [
        ["products", "products", "catalog.read"],
        ["vendors", "vendors", "vendors.read"],
        ["customers", "customers", "customers.read"],
        ["orders", "orders", "orders.read"],
        ["sourcing", "sourcing", "sourcing.read"],
        ["vouchers", "vouchers", "promotions.write"],
        ["returns", "returns", "returns.read"],
        ["team", "team", "team.manage"],
        ["audit", "audit", "audit.read"],
      ];
      for (const [stateKey, recordKind, capability] of recordCapabilities)
        if (hasCapability(user.role, capability))
          Object.assign(state, { [stateKey]: await records(db, recordKind) });
      if (user.role === "Support") {
        state.orders = state.orders.map(customerOrder) as unknown as Order[];
        state.sourcing = state.sourcing.map(
          customerRequest,
        ) as SourcingRequest[];
      }
    }
  }
  if (!operations && !testBuyer) {
    const requiredProductIds = new Set<string>([
      ...state.cart.map((line) => line.productId),
      ...state.savedForLater.map((line) => line.productId),
      ...state.wishlist,
      ...state.recentlyViewed,
      ...state.orders.flatMap((order) =>
        order.items.map((item) => item.productId),
      ),
    ]);
    const merchandisingIds = [...state.products]
      .sort(
        (left, right) =>
          Number(right.featured) - Number(left.featured) ||
          Number(right.newArrival) - Number(left.newArrival) ||
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      )
      .slice(0, 48)
      .map((product) => product.id);
    merchandisingIds.forEach((id) => requiredProductIds.add(id));
    state.products = state.products.filter((product) =>
      requiredProductIds.has(product.id),
    );
  }
  return state;
}
