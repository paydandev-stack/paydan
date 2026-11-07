import "server-only";
import { emptyState } from "@/lib/empty-state";
import { toPublicProduct, toMemberProduct } from "@/lib/catalog-dto";
import type { DemoState, Order, Product, SourcingRequest } from "@/lib/types";
import { database, records, record } from "./db";
import type { Viewer } from "./http";

export function customerOrder(order: Order) {
  return {
    ...order,
    items: order.items.map(
      ({ costPrice: _cost, vendorId: _vendor, ...item }) => item,
    ),
    shipments: order.vendorGroups.map((group, index) => ({
      id: group.id,
      label: `Delivery group ${index + 1}`,
      status:
        group.stage === "closed"
          ? "Delivered"
          : group.stage === "ready_for_dispatch"
            ? "Ready for dispatch"
            : order.fulfillmentStatus === "dispatched"
              ? "Dispatched"
              : "Processing",
      eta: group.eta,
      items: group.items.map(
        ({ costPrice: _cost, vendorId: _vendor, ...item }) => item,
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
export async function snapshot(
  user: Viewer | null,
  admin = false,
): Promise<DemoState> {
  const state = emptyState();
  // A disconnected installation can still preview the approved public design.
  // The source fixtures are evaluated only on the server and never contain customer records here.
  if (!process.env.DATABASE_URL) {
    const [{ products }, { categories }, { seedBanners }] = await Promise.all([
      import("@/data/products"),
      import("@/data/categories"),
      import("@/data/promotions"),
    ]);
    state.products = products
      .filter((p) => p.status === "published" && !p.restricted)
      .map(toPublicProduct) as unknown as Product[];
    state.categories = categories.filter((category) => !category.restricted);
    state.banners = seedBanners;
    return state;
  }
  const db = database();
  const operations = admin && Boolean(user?.role);
  for (const kind of [
    "products",
    "categories",
    "banners",
    "shippingZones",
  ] as const) {
    // Each entity is stored separately; customer ownership never comes from the request body.
    (state[kind] as unknown[]) = await records(db, kind);
  }
  state.settings = {
    ...state.settings,
    ...(await record(db, "settings", "store")),
    transferEnabled: false,
  };
  if (!operations || user?.role === "Support") {
    const restrictedCategories = new Set(
      state.categories
        .filter((category) => category.restricted)
        .map((category) => category.slug),
    );
    state.categories = state.categories.filter(
      (category) => !category.restricted,
    );
    state.products = state.products
      .filter(
        (p) =>
          p.status === "published" &&
          !p.restricted &&
          !restrictedCategories.has(p.categorySlug),
      )
      .map(user ? toMemberProduct : toPublicProduct) as unknown as Product[];
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
    const account = await record<Partial<DemoState>>(db, "accounts", user.id);
    for (const key of [
      "cart",
      "wishlist",
      "savedForLater",
      "addresses",
      "location",
      "lastOrderId",
      "lastSourcingReference",
    ] as const) {
      if (account?.[key] !== undefined)
        Object.assign(state, { [key]: account[key] });
    }
    state.orders = (await records<Order>(db, "orders", user.id)).map(
      customerOrder,
    ) as unknown as Order[];
    state.sourcing = (
      await records<SourcingRequest>(db, "sourcing", user.id)
    ).map(customerRequest) as SourcingRequest[];
    state.returns = await records(db, "returns", user.id);
    const profile = await record<{
      phone?: string;
      city?: string;
      state?: string;
    }>(db, "customers", user.id);
    state.customers = [
      {
        id: user.id,
        name: user.name,
        email: user.email,
        joinedAt: "",
        segments: [],
        notes: "",
        phone: profile?.phone ?? "",
        city: profile?.city ?? state.location.city,
        state: profile?.state ?? state.location.state,
      },
    ];
    if (operations) {
      state.adminSession = { id: user.id, name: user.name, role: user.role! };
      const accessible: Record<string, string[]> = {
        "Super Admin": [
          "products",
          "vendors",
          "customers",
          "orders",
          "sourcing",
          "vouchers",
          "returns",
          "team",
          "audit",
        ],
        "Catalog Manager": ["products", "vendors", "vouchers"],
        "Order Manager": ["orders", "vendors", "returns", "customers"],
        "Procurement Manager": ["orders", "vendors", "sourcing"],
        Support: ["orders", "customers", "sourcing", "returns"],
      };
      for (const kind of accessible[user.role!] ?? [])
        Object.assign(state, { [kind]: await records(db, kind) });
      if (user.role === "Support") {
        state.orders = state.orders.map(customerOrder) as unknown as Order[];
        state.sourcing = state.sourcing.map(
          customerRequest,
        ) as SourcingRequest[];
      }
    }
  }
  return state;
}
