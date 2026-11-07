"use client";

import { CatalogView } from "@/components/catalog/catalog-view";
import { visibleProducts } from "@/lib/catalog";
import { percentOff } from "@/lib/format";
import { useDemo } from "@/lib/store";

export default function DealsPage() {
  const { state } = useDemo();
  const signedIn = Boolean(state.customerSession);

  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order);

  const deals = visibleProducts(state.products).filter((product) =>
    signedIn
      ? percentOff(product.price, product.compareAt) !== null
      : product.featured,
  );

  // Discount framing is price-bearing copy: anonymous visitors get neutral
  // merchandising labels instead (consolidated plan §3).
  return (
    <CatalogView
      crumbs={[{ href: "/", label: "Home" }, { label: "Deals" }]}
      eyebrow={signedIn ? "On offer" : "Featured selection"}
      title={signedIn ? "Prices worth a second look" : "Worth a closer look"}
      description={
        signedIn
          ? "Explore current offers across the catalogue. Your final total is confirmed at checkout."
          : "A selection of finds from across Paydan's departments. Sign in to view price."
      }
      products={deals}
      departments={departments}
      emptyTitle={
        signedIn
          ? "No discounted products right now"
          : "Nothing selected right now"
      }
      emptyMessage={
        signedIn
          ? "Offers rotate when suppliers change their pricing. Browse the full catalogue in the meantime."
          : "Browse the full catalogue in the meantime."
      }
    />
  );
}
