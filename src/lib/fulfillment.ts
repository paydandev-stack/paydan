import type { Product, Vendor, VendorFulfillmentLocation } from "./types";

export function legacyPrimaryLocation(
  vendor: Vendor,
): VendorFulfillmentLocation {
  return {
    id: `${vendor.id}-primary`,
    vendorId: vendor.id,
    label: "Primary fulfilment location",
    address: vendor.address || "",
    city: vendor.city || "",
    state: vendor.state || "",
    isPrimary: true,
    active: true,
    pickupAvailable: false,
    dispatchLeadTimeDays: vendor.leadTimeDays,
  };
}

export function vendorLocations(vendor: Vendor): VendorFulfillmentLocation[] {
  return vendor.fulfillmentLocations?.length
    ? vendor.fulfillmentLocations
    : [legacyPrimaryLocation(vendor)];
}

export function productLocation(product: Product, vendor: Vendor) {
  const locations = vendorLocations(vendor).filter(
    (location) => location.active,
  );
  return (
    locations.find(
      (location) => location.id === product.fulfillmentLocationId,
    ) ||
    locations.find((location) => location.isPrimary) ||
    locations[0]
  );
}

export function proximityLabel(
  location: Pick<VendorFulfillmentLocation, "city" | "state">,
  buyer?: { city?: string; state?: string },
) {
  if (
    buyer?.city &&
    location.city &&
    location.city.localeCompare(buyer.city, undefined, {
      sensitivity: "accent",
    }) === 0
  )
    return "same-city" as const;
  if (
    buyer?.state &&
    location.state &&
    location.state.localeCompare(buyer.state, undefined, {
      sensitivity: "accent",
    }) === 0
  )
    return "same-state" as const;
  return "interstate" as const;
}
