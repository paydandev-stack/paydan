"use client";

import { notFound, useParams } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { visibleProducts } from "@/lib/catalog";
import { useDemo } from "@/lib/store";

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const { state } = useDemo();

  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const category = state.categories.find((item) => item.slug === slug);

  // Restricted departments stay out of every public surface.
  if (!category || category.restricted) notFound();

  const products = visibleProducts(state.products).filter(
    (product) => product.categorySlug === category.slug,
  );

  return (
    <CatalogView
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/categories", label: "Departments" },
        { label: category.name },
      ]}
      eyebrow={category.name}
      title={category.title}
      description={category.description}
      products={products}
      emptyTitle={`No ${category.name.toLowerCase()} products published yet`}
      emptyMessage="This department is being stocked. Send a sourcing request and Paydan's team will find a supplier for the exact item you need."
    />
  );
}
