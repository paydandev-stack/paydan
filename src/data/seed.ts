import "server-only";
import type { DemoState, Product, ShippingZone } from "@/lib/types";
import { categories } from "./categories";
import { customers } from "./customers";
import { seedAddresses } from "./customers";
import { seedOrders } from "./orders";
import { products } from "./products";
import { sampleVouchers, seedBanners } from "./promotions";
import { seedReturns } from "./returns";
import { seedSourcing } from "./sourcing";
import { seedAudit, storeSettings, team } from "./team";
import { vendors } from "./vendors";

export const shippingZones: ShippingZone[] = [
  {
    id: "z-1",
    state: "Lagos",
    fee: 2500,
    eta: "1-3 working days",
    active: true,
  },
  { id: "z-2", state: "FCT", fee: 4500, eta: "2-4 working days", active: true },
  {
    id: "z-3",
    state: "Rivers",
    fee: 5000,
    eta: "3-5 working days",
    active: true,
  },
  {
    id: "z-4",
    state: "Kano",
    fee: 5500,
    eta: "3-6 working days",
    active: true,
  },
  { id: "z-5", state: "Oyo", fee: 3500, eta: "2-4 working days", active: true },
  {
    id: "z-6",
    state: "Enugu",
    fee: 4200,
    eta: "3-5 working days",
    active: true,
  },
];

export const nigerianStates = [
  "Lagos",
  "FCT",
  "Rivers",
  "Kano",
  "Oyo",
  "Enugu",
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Plateau",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

/**
 * Creates a fresh, JSON-safe copy of the demonstration dataset.
 * Kept as a function so a page refresh in "reset demo" mode returns to the
 * exact same starting point.
 */
export function createSeedState(): DemoState {
  return structuredClone({
    products,
    categories,
    vendors,
    customers,
    orders: seedOrders,
    sourcing: seedSourcing,
    banners: seedBanners,
    vouchers: sampleVouchers.map((voucher) => ({ ...voucher, active: true })),
    returns: seedReturns,
    team,
    shippingZones,
    settings: storeSettings,
    cart: [],
    wishlist: [],
    savedForLater: [],
    addresses: seedAddresses,
    audit: seedAudit,
    customerSession: null,
    adminSession: null,
    location: { state: "Lagos", city: "Ikeja" },
    lastOrderId: undefined,
    lastSourcingReference: undefined,
    toasts: [],
  } satisfies DemoState);
}

/** Products a shopper is allowed to see: published and not restricted. */
export function visibleProducts(products: Product[]): Product[] {
  return products.filter(
    (product) => product.status === "published" && !product.restricted,
  );
}

/** Products visible in the admin catalogue, including unpublished previews. */
export function adminProducts(products: Product[]): Product[] {
  return products;
}

export function deliveryFeeFor(
  state: string,
  zones: ShippingZone[],
): number | null {
  const zone = zones.find((zone) => zone.state === state && zone.active);
  return zone ? zone.fee : null;
}

export function deliveryEtaFor(state: string, zones: ShippingZone[]): string {
  return (
    zones.find((zone) => zone.state === state && zone.active)?.eta ??
    "Confirmed after order review"
  );
}
