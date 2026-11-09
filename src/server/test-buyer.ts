import "server-only";

import type {
  DemoState,
  Order,
  ReturnRequest,
  SourcingRequest,
} from "@/lib/types";
import { products } from "@/data/products";
import { seedAddresses } from "@/data/customers";
import { seedOrders } from "@/data/orders";
import { seedReturns } from "@/data/returns";
import { shippingZones } from "@/data/seed";
import { seedSourcing } from "@/data/sourcing";
import { vendors } from "@/data/vendors";
import { put, record, transaction } from "./db";

type Identity = { id: string; name: string; email: string };

const TEST_DATA_VERSION = 1;
const TEST_KINDS = [
  "testProducts",
  "testVendors",
  "testOrders",
  "testSourcing",
  "testReturns",
  "testShippingZones",
] as const;

export function testBuyerEmail() {
  return (
    process.env.TEST_BUYER_EMAIL ||
    process.env.SEED_BUYER_EMAIL ||
    "buyer@paydan.local"
  )
    .trim()
    .toLowerCase();
}

export function isTestBuyer(user: Pick<Identity, "email"> | null | undefined) {
  return user?.email.trim().toLowerCase() === testBuyerEmail();
}

export function productRecordKind(user: Pick<Identity, "email">) {
  return isTestBuyer(user) ? "testProducts" : "products";
}

function testOrders(user: Identity): Order[] {
  return [0, 1, 4, 5].map((sourceIndex, index) => {
    const source = structuredClone(seedOrders[sourceIndex]);
    const id = `test-order-${index + 1}`;
    return {
      ...source,
      id,
      reference: `TEST-PD-${String(index + 1).padStart(4, "0")}`,
      customerId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      address: {
        ...source.address,
        id: `${id}-address`,
        recipient: user.name,
      },
      vendorGroups: source.vendorGroups.map((group, groupIndex) => ({
        ...group,
        id: `${id}-supplier-${groupIndex + 1}`,
      })),
    };
  });
}

function testSourcing(user: Identity): SourcingRequest[] {
  return seedSourcing.slice(0, 3).map((source, index) => ({
    ...structuredClone(source),
    id: `test-sourcing-${index + 1}`,
    reference: `TEST-SR-${String(index + 1).padStart(3, "0")}`,
    customerId: user.id,
    customerName: user.name,
    email: user.email,
    convertedOrderId: undefined,
  }));
}

function testReturns(user: Identity, orders: Order[]): ReturnRequest[] {
  const order = orders.find((item) => item.fulfillmentStatus === "delivered");
  const item = order?.items[0];
  if (!order || !item) return [];
  return [
    {
      ...structuredClone(seedReturns[0]),
      id: "test-return-1",
      reference: "TEST-RT-001",
      orderId: order.id,
      customerId: user.id,
      productId: item.productId,
      productName: item.name,
      status: "under_review",
      adminNote: "",
    },
  ];
}

/**
 * Populates a private demonstration scope on the test buyer's first
 * authenticated request. A version marker makes repeated post-login requests
 * cheap and prevents duplicate records.
 */
export async function ensureTestBuyerData(user: Identity) {
  if (!isTestBuyer(user)) return false;
  return transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `test-buyer:${user.id}`,
    ]);
    const marker = await record<{ version: number }>(
      db,
      "testSeedVersions",
      user.id,
    );
    if (marker?.version === TEST_DATA_VERSION) return false;

    await db.query(
      `DELETE FROM commerce_record
       WHERE owner_id=$1
       AND kind IN ('testProducts','testVendors','testOrders','testSourcing','testReturns','testShippingZones')`,
      [user.id],
    );

    for (const product of products)
      await put(db, "testProducts", product.id, product, user.id);
    for (const vendor of vendors)
      await put(db, "testVendors", vendor.id, vendor, user.id);
    for (const zone of shippingZones)
      await put(db, "testShippingZones", zone.id, zone, user.id);

    const orders = testOrders(user);
    for (const order of orders)
      await put(db, "testOrders", order.id, order, user.id);
    for (const request of testSourcing(user))
      await put(db, "testSourcing", request.id, request, user.id);
    for (const request of testReturns(user, orders))
      await put(db, "testReturns", request.id, request, user.id);

    const existing = await record<Partial<DemoState>>(db, "accounts", user.id);
    const available = products.filter(
      (product) =>
        product.status === "published" &&
        !product.restricted &&
        product.variants.some(
          (variant) => variant.availability !== "out_of_stock",
        ),
    );
    const first = available[0];
    const second = available[1];
    await put(
      db,
      "accounts",
      user.id,
      {
        ...existing,
        cart:
          existing?.cart?.length || !first
            ? (existing?.cart ?? [])
            : [
                {
                  productId: first.id,
                  variantId: first.variants[0].id,
                  quantity: 1,
                },
              ],
        wishlist:
          existing?.wishlist?.length || !second
            ? (existing?.wishlist ?? [])
            : available.slice(1, 4).map((product) => product.id),
        savedForLater:
          existing?.savedForLater?.length || !second
            ? (existing?.savedForLater ?? [])
            : [
                {
                  productId: second.id,
                  variantId: second.variants[0].id,
                  quantity: 1,
                },
              ],
        addresses:
          existing?.addresses?.length
            ? existing.addresses
            : seedAddresses.map((address) => ({
                ...address,
                recipient: user.name,
              })),
        location: existing?.location ?? { state: "Lagos", city: "Ikeja" },
        lastOrderId: existing?.lastOrderId,
        lastSourcingReference: existing?.lastSourcingReference,
      },
      user.id,
    );
    await put(
      db,
      "testSeedVersions",
      user.id,
      {
        version: TEST_DATA_VERSION,
        seededAt: new Date().toISOString(),
        kinds: TEST_KINDS,
      },
      user.id,
    );
    return true;
  });
}
