"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CatalogView } from "@/components/catalog/catalog-view";
import { visibleProducts } from "@/lib/catalog";
import { useDemo } from "@/lib/store";

function SearchResults() {
  const searchParams = useSearchParams();
  const { state } = useDemo();

  const query = (searchParams.get("q") ?? "").trim();
  const needle = query.toLowerCase();

  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order);

  const results = query
    ? visibleProducts(state.products).filter((product) => {
        const department = state.categories.find(
          (category) => category.slug === product.categorySlug,
        );
        return [
          product.name,
          product.brand,
          product.description,
          department?.name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
    : [];

  if (!query) {
    return (
      <div className="wrap catalog-page">
        <header className="catalog-hero">
          <span className="kicker green">Search</span>
          <h1>What are you looking for?</h1>
          <p>
            Search the catalogue by product, brand or department from the bar
            above — or <Link href="/request-product">request a product</Link> we
            do not list yet.
          </p>
        </header>
        <div className="empty">
          <h3>Enter a search term to begin</h3>
          <p>Try “laptop”, “skincare” or a brand name.</p>
          <Link href="/shop">Browse everything instead</Link>
        </div>
      </div>
    );
  }

  return (
    <CatalogView
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/shop", label: "Shop" },
        { label: "Search" },
      ]}
      eyebrow="Search results"
      title={`Results for “${query}”`}
      description={`${results.length === 0 ? "No matches" : "Matching products"} across the Paydan catalogue. Search covers product names, brands, descriptions and departments.`}
      products={results}
      departments={departments}
      emptyTitle={`Nothing matched “${query}”`}
      emptyMessage="Check the spelling, try a broader term, or send a sourcing request and we will look for the item."
    />
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap catalog-page">
          <div className="empty">
            <h3>Searching…</h3>
          </div>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
