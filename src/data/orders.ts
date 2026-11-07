import "server-only";
import type {
  FulfillmentStatus,
  Order,
  OrderItem,
  PaymentStatus,
  ProcurementStage,
  TimelineEvent,
  VendorSubOrder,
} from "@/lib/types";
import { customerById } from "./customers";
import { productById } from "./products";
import { vendorById } from "./vendors";

type SeedItem = { productId: string; variantIndex?: number; quantity: number };

type Seed = {
  customerId: string;
  placedAt: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  items: SeedItem[];
  discount?: number;
  notes?: string;
  paymentMethod?: "paystack" | "transfer";
};

const DELIVERY_FEES: Record<string, number> = {
  Lagos: 2500,
  FCT: 4500,
  Rivers: 5000,
  Kano: 5500,
  Oyo: 3500,
  Enugu: 4200,
};

const ASSIGNEES = ["Tunde Salami", "Ngozi Eze", "Chinedu Obi", "Halima Yusuf"];

const stageFor = (
  fulfillment: FulfillmentStatus,
  index: number,
): ProcurementStage => {
  switch (fulfillment) {
    case "awaiting_payment":
      return "awaiting_assignment";
    case "processing":
      return index === 0 ? "contact_vendor" : "awaiting_confirmation";
    case "sourcing":
      return "awaiting_confirmation";
    case "partially_packed":
      return index === 0 ? "supplier_fulfilled" : "ordered_from_supplier";
    case "dispatched":
      return "ready_for_dispatch";
    case "delivered":
      return "closed";
    case "cancelled":
      return "blocked";
    default:
      return "awaiting_assignment";
  }
};

const doneCount: Record<FulfillmentStatus, number> = {
  awaiting_payment: 1,
  processing: 2,
  sourcing: 2,
  partially_packed: 3,
  dispatched: 4,
  delivered: 5,
  cancelled: 2,
};

function buildTimeline(seed: Seed): TimelineEvent[] {
  const placed = new Date(seed.placedAt);
  const at = (days: number) =>
    new Date(placed.getTime() + days * 86_400_000).toISOString();
  const labels: { label: string; days: number }[] = [
    { label: "Order received", days: 0 },
    {
      label:
        seed.paymentStatus === "pending"
          ? "Awaiting payment"
          : seed.paymentStatus === "failed"
            ? "Payment failed"
            : "Payment confirmed",
      days: 0,
    },
    { label: "Sourcing / processing", days: 1 },
    { label: "Dispatched", days: 3 },
    { label: "Delivered", days: 5 },
  ];
  const done = doneCount[seed.fulfillmentStatus];
  return labels.map((entry, index) => ({
    label: entry.label,
    at: index < done ? at(entry.days) : "",
    done: index < done,
    ...(seed.fulfillmentStatus === "cancelled" && index === 2
      ? { note: "Order cancelled after payment; refund recorded in demo data." }
      : {}),
  }));
}

function buildItems(items: SeedItem[]): OrderItem[] {
  return items.map((item) => {
    const product = productById(item.productId);
    if (!product)
      throw new Error(`Unknown product in seed order: ${item.productId}`);
    const variant =
      product.variants[item.variantIndex ?? 0] ?? product.variants[0];
    return {
      productId: product.id,
      name: product.name,
      variantLabel: variant.label,
      image: product.images[0],
      unitPrice: variant.price,
      costPrice: product.costPrice,
      quantity: item.quantity,
      vendorId: product.vendorId,
      categorySlug: product.categorySlug,
    };
  });
}

function buildVendorGroups(
  orderId: string,
  items: OrderItem[],
  seed: Seed,
  placedAt: string,
): VendorSubOrder[] {
  const byVendor = new Map<string, OrderItem[]>();
  for (const item of items) {
    const list = byVendor.get(item.vendorId) ?? [];
    list.push(item);
    byVendor.set(item.vendorId, list);
  }
  return [...byVendor.entries()].map(([vendorId, vendorItems], index) => {
    const vendor = vendorById(vendorId);
    const stage = stageFor(seed.fulfillmentStatus, index);
    const eta = new Date(
      new Date(placedAt).getTime() +
        ((vendor?.leadTimeDays ?? 3) + 2) * 86_400_000,
    ).toISOString();
    return {
      id: `${orderId}-so-${index + 1}`,
      vendorId,
      items: vendorItems,
      stage,
      assignee: ASSIGNEES[index % ASSIGNEES.length],
      eta,
      urgent: seed.fulfillmentStatus === "processing" && index === 0,
      notes:
        stage === "blocked"
          ? "Order cancelled — supplier not instructed."
          : vendor?.status === "on_hold"
            ? "Supplier on hold: confirm licence status before ordering."
            : "",
      updatedAt: placedAt,
    };
  });
}

let sequence = 1067;

function seedOrder(seed: Seed): Order {
  const reference = `PD-2026-${sequence--}`;
  const customer = customerById(seed.customerId);
  if (!customer) throw new Error(`Unknown customer: ${seed.customerId}`);
  const items = buildItems(seed.items);
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const deliveryFee = DELIVERY_FEES[customer.state] ?? 4000;
  const discount = seed.discount ?? 0;
  const orderId = reference.toLowerCase();
  return {
    id: orderId,
    reference,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    placedAt: seed.placedAt,
    paymentStatus: seed.paymentStatus,
    fulfillmentStatus: seed.fulfillmentStatus,
    paymentMethod: seed.paymentMethod ?? "paystack",
    items,
    subtotal,
    deliveryFee,
    discount,
    total: subtotal + deliveryFee - discount,
    address: {
      id: `${orderId}-addr`,
      label: "Delivery address",
      recipient: customer.name,
      phone: customer.phone,
      street: `${12 + (sequence % 20)} Example Street`,
      landmark: "Landmark shared at checkout",
      city: customer.city,
      state: customer.state,
      isDefault: false,
    },
    vendorGroups: buildVendorGroups(orderId, items, seed, seed.placedAt),
    timeline: buildTimeline(seed),
    notes: seed.notes ?? "",
    trackingCode: `PDT-${reference.slice(-4)}-${customer.id.toUpperCase()}`,
  };
}

/**
 * 20 seeded orders spread across payment and fulfilment states.
 * PD-2026-1067 and PD-2026-1048 both span three suppliers so the
 * "Toggle sub-orders" view has realistic data to show.
 */
export const seedOrders: Order[] = [
  seedOrder({
    customerId: "c-1",
    placedAt: "2026-10-31T10:20:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "sourcing",
    items: [
      { productId: "p-10", quantity: 1 },
      { productId: "p-01", quantity: 2 },
      { productId: "p-20", quantity: 1 },
    ],
    notes: "Customer asked for a delivery call before dispatch.",
  }),
  seedOrder({
    customerId: "c-2",
    placedAt: "2026-10-30T15:05:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "processing",
    items: [{ productId: "p-11", quantity: 1 }],
  }),
  seedOrder({
    customerId: "c-3",
    placedAt: "2026-10-30T09:12:00Z",
    paymentStatus: "pending",
    fulfillmentStatus: "awaiting_payment",
    items: [{ productId: "p-06", variantIndex: 1, quantity: 1 }],
  }),
  seedOrder({
    customerId: "c-4",
    placedAt: "2026-10-29T18:44:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "partially_packed",
    items: [
      { productId: "p-29", quantity: 1 },
      { productId: "p-38", quantity: 2 },
    ],
  }),
  seedOrder({
    customerId: "c-5",
    placedAt: "2026-10-29T11:30:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "dispatched",
    items: [{ productId: "p-31", quantity: 1 }],
    notes: "Delivery access code provided.",
  }),
  seedOrder({
    customerId: "c-6",
    placedAt: "2026-10-28T13:02:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "delivered",
    items: [
      { productId: "p-24", quantity: 1 },
      { productId: "p-25", variantIndex: 2, quantity: 1 },
    ],
  }),
  seedOrder({
    customerId: "c-7",
    placedAt: "2026-10-27T08:55:00Z",
    paymentStatus: "failed",
    fulfillmentStatus: "awaiting_payment",
    items: [{ productId: "p-14", quantity: 1 }],
    notes: "Sample payment failed; customer can retry.",
  }),
  seedOrder({
    customerId: "c-8",
    placedAt: "2026-10-26T16:21:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "sourcing",
    items: [
      { productId: "p-02", quantity: 3 },
      { productId: "p-05", quantity: 2 },
    ],
  }),
  seedOrder({
    customerId: "c-1",
    placedAt: "2026-10-25T12:10:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "delivered",
    items: [{ productId: "p-26", quantity: 1 }],
    discount: 5000,
    notes: "Voucher SAMPLE5000 applied.",
  }),
  seedOrder({
    customerId: "c-2",
    placedAt: "2026-10-23T09:40:00Z",
    paymentStatus: "refunded",
    fulfillmentStatus: "cancelled",
    items: [{ productId: "p-13", quantity: 1 }],
    notes: "Cancelled at customer request before dispatch.",
  }),
  seedOrder({
    customerId: "c-3",
    placedAt: "2026-10-21T14:18:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "processing",
    items: [{ productId: "p-41", quantity: 1 }],
  }),
  seedOrder({
    customerId: "c-4",
    placedAt: "2026-10-19T10:05:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "sourcing",
    items: [{ productId: "p-32", quantity: 1 }],
  }),
  seedOrder({
    customerId: "c-5",
    placedAt: "2026-10-18T17:33:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "delivered",
    items: [
      { productId: "p-38", quantity: 1 },
      { productId: "p-39", quantity: 1 },
    ],
  }),
  seedOrder({
    customerId: "c-6",
    placedAt: "2026-10-16T11:11:00Z",
    paymentStatus: "pending",
    fulfillmentStatus: "awaiting_payment",
    items: [{ productId: "p-22", quantity: 1 }],
  }),
  seedOrder({
    customerId: "c-7",
    placedAt: "2026-10-15T08:20:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "partially_packed",
    items: [
      { productId: "p-13", quantity: 1 },
      { productId: "p-33", quantity: 1 },
    ],
  }),
  seedOrder({
    customerId: "c-8",
    placedAt: "2026-10-13T15:47:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "dispatched",
    items: [{ productId: "p-40", quantity: 1 }],
  }),
  seedOrder({
    customerId: "c-1",
    placedAt: "2026-10-11T09:05:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "delivered",
    items: [
      { productId: "p-26", quantity: 1 },
      { productId: "p-23", quantity: 2 },
    ],
  }),
  seedOrder({
    customerId: "c-2",
    placedAt: "2026-10-09T13:39:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "sourcing",
    items: [
      { productId: "p-11", quantity: 1 },
      { productId: "p-12", quantity: 1 },
    ],
  }),
  seedOrder({
    customerId: "c-3",
    placedAt: "2026-10-06T10:00:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "delivered",
    items: [
      { productId: "p-27", quantity: 1 },
      { productId: "p-30", quantity: 1 },
    ],
  }),
  seedOrder({
    customerId: "c-4",
    placedAt: "2026-10-02T16:28:00Z",
    paymentStatus: "paid",
    fulfillmentStatus: "processing",
    items: [
      { productId: "p-24", quantity: 1 },
      { productId: "p-14", quantity: 2 },
      { productId: "p-07", quantity: 1 },
    ],
  }),
];

export function vendorGroupTotal(group: VendorSubOrder): number {
  return group.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
}

export function vendorGroupCost(group: VendorSubOrder): number {
  return group.items.reduce(
    (sum, item) => sum + item.costPrice * item.quantity,
    0,
  );
}

export function orderCost(order: Order): number {
  return order.items.reduce(
    (sum, item) => sum + item.costPrice * item.quantity,
    0,
  );
}
