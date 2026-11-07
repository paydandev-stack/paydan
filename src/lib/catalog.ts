import type { Product, ShippingZone } from "./types";
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
