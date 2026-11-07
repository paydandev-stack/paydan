"use client";

import { CatalogView } from "@/components/catalog/catalog-view";
import { visibleProducts } from "@/lib/catalog";
import { useDemo } from "@/lib/store";

export default function NewArrivalsPage() {
  const { state } = useDemo();

  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order);

  const products = visibleProducts(state.products);
  const flagged = products.filter((product) => product.newArrival);
  const newcomers = flagged.length
    ? flagged
    : [...products]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 12);

  return (
    <CatalogView
      crumbs={[{ href: "/", label: "Home" }, { label: "New arrivals" }]}
      eyebrow="Just in"
      title="Newly added to the store"
      description="Recently published products across Paydan's departments. Availability follows each supplier, so some items are confirmed after you order."
      products={newcomers}
      departments={departments}
      emptyTitle="Nothing new published yet"
      emptyMessage="New products appear here as soon as they are published from the admin catalogue."
    />
  );
}
