import { database, record, records } from "./db";
import type { Order, Product, Vendor } from "@/lib/types";
import { HttpError } from "@/server/http";
import type { Viewer } from "@/server/http";

export type VendorProduct = Pick<
  Product,
  | "id"
  | "slug"
  | "sku"
  | "name"
  | "images"
  | "description"
  | "highlights"
  | "specifications"
  | "price"
  | "compareAt"
  | "availability"
  | "variants"
  | "status"
  | "updatedAt"
> & {
  stock: number;
  variantStock: Record<string, number>;
  imageAlts?: Record<string, string>;
};

export type VendorOrder = {
  id: string;
  reference: string;
  placedAt: string;
  customerName: string;
  fulfillmentStatus: Order["fulfillmentStatus"];
  paymentStatus: Order["paymentStatus"];
  total: number;
  stage: string;
  eta: string;
  itemCount: number;
};

export type VendorSnapshot = {
  vendor: Pick<
    Vendor,
    | "id"
    | "name"
    | "fulfillmentLocations"
    | "address"
    | "city"
    | "state"
    | "leadTimeDays"
  >;
  products: VendorProduct[];
  orders: VendorOrder[];
};

export function vendorIdFor(user: Viewer): string {
  if (user.role !== "Vendor" || !user.vendorId)
    throw new HttpError(403, "Vendor access is required.");
  return user.vendorId;
}

export async function assertVendorCatalogAccess(user: Viewer): Promise<string> {
  const vendorId = vendorIdFor(user);
  const [member, vendor] = await Promise.all([
    user.teamMemberId
      ? record<{ status: string; vendorId?: string }>(
          database(),
          "team",
          user.teamMemberId,
        )
      : Promise.resolve(undefined),
    record<{ status: string }>(database(), "vendors", vendorId),
  ]);
  if (
    !member ||
    member.status !== "active" ||
    member.vendorId !== vendorId ||
    !vendor ||
    vendor.status !== "active"
  )
    throw new HttpError(403, "This vendor account is not active.");
  return vendorId;
}

export async function getVendorSnapshot(user: Viewer): Promise<VendorSnapshot> {
  const vendorId = vendorIdFor(user);
  const db = database();
  const [vendor, allProducts, allOrders, inventoryRows] = await Promise.all([
    record<Vendor>(db, "vendors", vendorId),
    records<Product>(db, "products"),
    records<Order>(db, "orders"),
    db.query<{
      product_id: string;
      variant_id: string;
      available: number;
    }>(
      `SELECT product_id,variant_id,sum(available)::int AS available
       FROM inventory GROUP BY product_id,variant_id`,
    ),
  ]);
  if (!vendor || vendor.status !== "active")
    throw new HttpError(403, "This vendor account is not active.");

  const stock = new Map<string, number>();
  for (const row of inventoryRows.rows)
    stock.set(
      row.product_id + ":" + row.variant_id,
      Number(row.available) || 0,
    );

  const products = allProducts
    .filter((product) => product.vendorId === vendorId)
    .map((product): VendorProduct => {
      const { costPrice: _costPrice, vendorId: _vendorId, ...safe } = product;
      const variantStock = Object.fromEntries(
        product.variants.map((variant) => [
          variant.id,
          stock.get(product.id + ":" + variant.id) ?? 0,
        ]),
      );
      return {
        ...safe,
        variantStock,
        stock: Object.values(variantStock).reduce(
          (sum, value) => sum + value,
          0,
        ),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const orders = allOrders
    .flatMap((order): VendorOrder[] => {
      const groups = order.vendorGroups.filter(
        (group) => group.vendorId === vendorId,
      );
      return groups.map((group) => ({
        id: order.id,
        reference: order.reference,
        placedAt: order.placedAt,
        customerName: order.customerName,
        fulfillmentStatus: order.fulfillmentStatus,
        paymentStatus: order.paymentStatus,
        total: group.items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        ),
        stage: group.stage,
        eta: group.eta,
        itemCount: group.items.reduce((sum, item) => sum + item.quantity, 0),
      }));
    })
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));

  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      fulfillmentLocations: vendor.fulfillmentLocations,
      address: vendor.address,
      city: vendor.city,
      state: vendor.state,
      leadTimeDays: vendor.leadTimeDays,
    },
    products,
    orders,
  };
}
