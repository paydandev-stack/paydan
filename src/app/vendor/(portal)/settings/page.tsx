import { VendorLocations } from "@/components/vendor/vendor-locations";
import { VendorShell } from "@/components/vendor/vendor-shell";
import { legacyPrimaryLocation, vendorLocations } from "@/lib/fulfillment";
import type { Vendor } from "@/lib/types";
import { getVendorSnapshot } from "@/server/vendor";
import { requireVendorPage } from "@/server/vendor-page";

export default async function VendorSettingsPage() {
  const user = await requireVendorPage();
  const snapshot = await getVendorSnapshot(user);
  const vendor = snapshot.vendor as Vendor;
  const locations = vendorLocations(vendor);
  return (
    <VendorShell
      active="settings"
      vendorName={snapshot.vendor.name}
      email={user.email}
    >
      <div className="vendor-page">
        <div className="vendor-page-heading">
          <div>
            <span className="vendor-kicker">FULFILMENT</span>
            <h1>Warehouse locations</h1>
            <p>
              Only city, state, delivery timing and pickup availability are
              shown to shoppers.
            </p>
          </div>
        </div>
        <VendorLocations
          vendorId={vendor.id}
          initial={
            locations.length ? locations : [legacyPrimaryLocation(vendor)]
          }
        />
      </div>
    </VendorShell>
  );
}
