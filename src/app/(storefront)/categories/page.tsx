"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";
import { visibleProducts } from "@/lib/catalog";
import { plural } from "@/lib/format";
import { ChevronRightIcon } from "@/components/icons";

export default function CategoriesPage() {
  const { state } = useDemo();
  const products = visibleProducts(state.products);

  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="wrap categories-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Departments</strong>
      </nav>

      <header className="catalog-hero">
        <span className="kicker green">Shop by department</span>
        <h1>One storefront, many aisles.</h1>
        <p>
          Each department is stocked through Paydan&rsquo;s supplier network.
          Some items are held with the supplier and confirmed once you order.
        </p>
      </header>

      <div className="directory-grid">
        {departments.map((department, index) => {
          const count = products.filter(
            (product) => product.categorySlug === department.slug,
          ).length;

          return (
            <Link key={department.slug} href={`/category/${department.slug}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{department.name}</h2>
                <p>{department.description}</p>
                <small>{plural(count, "product")}</small>
              </div>
              <ChevronRightIcon />
            </Link>
          );
        })}
      </div>

      <p className="directory-note">
        Restricted departments are not shown on public pages. Products you
        cannot find anywhere in the store can be requested through{" "}
        <Link href="/request-product">Paydan sourcing</Link>.
      </p>
    </div>
  );
}
