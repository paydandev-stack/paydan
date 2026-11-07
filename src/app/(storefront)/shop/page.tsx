"use client";

import { CatalogView } from "@/components/catalog/catalog-view";
import { visibleProducts } from "@/lib/catalog";
import { useDemo } from "@/lib/store";

export default function ShopPage() {
  const { state } = useDemo();

  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order);

  return (
    <CatalogView
      crumbs={[{ href: "/", label: "Home" }, { label: "Shop" }]}
      eyebrow="The full catalogue"
      title="Everything on Paydan"
      description="Every published product across the storefront. Sign in to view current prices and shop."
      products={visibleProducts(state.products)}
      departments={departments}
    />
  );
}
