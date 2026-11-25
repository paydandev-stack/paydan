import { VendorProducts } from "@/components/vendor/vendor-products";
import { VendorShell } from "@/components/vendor/vendor-shell";
import { getVendorSnapshot } from "@/server/vendor";
import { requireVendorPage } from "@/server/vendor-page";

export default async function VendorProductsPage() {
  const user = await requireVendorPage();
  const snapshot = await getVendorSnapshot(user);
  const lowStock = snapshot.products.filter((product) => product.stock < 10);

  return (
    <VendorShell
      active="products"
      vendorName={snapshot.vendor.name}
      email={user.email}
    >
      <div className="vendor-page">
        <div className="vendor-page-heading">
          <div>
            <span className="vendor-kicker">CATALOGUE</span>
            <h1>My catalogue</h1>
            <p>
              {snapshot.products.length} assigned products · {lowStock.length}{" "}
              running low on stock
            </p>
          </div>
          <div className="vendor-inline-stat">
            <strong>
              {snapshot.products.filter((p) => p.status === "published").length}
            </strong>
            <span>Published</span>
          </div>
        </div>
        <VendorProducts products={snapshot.products} />
      </div>
    </VendorShell>
  );
}
