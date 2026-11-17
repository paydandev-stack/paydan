"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { SlidersIcon } from "@/components/icons";
import { plural } from "@/lib/format";
import { toViewerProducts } from "@/lib/catalog-dto";
import { availabilityMeta } from "@/lib/status";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
import type { Availability, Category, Product } from "@/lib/types";

type Crumb = { href?: string; label: string };

type SortKey = "featured" | "price-asc" | "price-desc" | "newest" | "name";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name: A–Z" },
];

const priceBands = [
  {
    id: "under-25k",
    label: "Under ₦25,000",
    test: (price: number) => price < 25_000,
  },
  {
    id: "25k-100k",
    label: "₦25,000 – ₦100,000",
    test: (price: number) => price >= 25_000 && price < 100_000,
  },
  {
    id: "100k-500k",
    label: "₦100,000 – ₦500,000",
    test: (price: number) => price >= 100_000 && price < 500_000,
  },
  {
    id: "over-500k",
    label: "₦500,000 and above",
    test: (price: number) => price >= 500_000,
  },
];

const availabilityOrder: Availability[] = [
  "in_stock",
  "supplier_confirm",
  "preorder",
  "out_of_stock",
];

export type CatalogViewProps = {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
  /** Departments offered as quick chips above the grid. */
  departments?: Category[];
  emptyTitle?: string;
  emptyMessage?: string;
  serverQuery?: {
    q?: string;
    department?: string;
    collection?: "all" | "deals" | "new-arrivals" | "featured";
  };
};

/**
 * Shared listing surface for /shop, /deals, /new-arrivals, /search and every
 * /category/[slug] page. Filters are applied in memory over store records.
 */
export function CatalogView({
  crumbs,
  eyebrow,
  title,
  description,
  products,
  departments,
  emptyTitle = "Nothing matches those filters",
  emptyMessage = "Try clearing a filter, or request the product and our sourcing team will look for it.",
  serverQuery,
}: CatalogViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [department, setDepartment] = useState<string>(
    searchParams.get("department") || "all",
  );
  const [availability, setAvailability] = useState<Availability[]>(() =>
    (searchParams.get("availability") ?? "")
      .split(",")
      .filter((value): value is Availability =>
        availabilityOrder.includes(value as Availability),
      ),
  );
  const [bands, setBands] = useState<string[]>(() =>
    (searchParams.get("priceBands") ?? "").split(",").filter(Boolean),
  );
  const [brands, setBrands] = useState<string[]>(() =>
    (searchParams.get("brands") ?? "").split(",").filter(Boolean),
  );
  const [sort, setSort] = useState<SortKey>(() => {
    const value = searchParams.get("sort") as SortKey | null;
    return sortOptions.some((option) => option.value === value)
      ? value!
      : "featured";
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { state } = useDemo();
  const signedIn = Boolean(state.customerSession);
  const useRemote = Boolean(serverQuery) && state.dataScope !== "test";
  const [remoteProducts, setRemoteProducts] = useState<Product[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteCursor, setRemoteCursor] = useState<string | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const requestVersion = useRef(0);

  /**
   * Anonymous surfaces carry no money at all: price filters and price sort
   * controls are removed for guests, and a member's price sort falls back to
   * the default if they sign out mid-session.
   */
  const visibleSortOptions = signedIn
    ? sortOptions
    : sortOptions.filter((option) => !option.value.startsWith("price-"));
  const effectiveSort: SortKey =
    signedIn || !sort.startsWith("price-") ? sort : "featured";

  const fetchRemote = useCallback(
    async (cursor?: string, append = false) => {
      if (!useRemote) return;
      const version = ++requestVersion.current;
      const params = new URLSearchParams({
        sort: effectiveSort,
        collection: serverQuery?.collection ?? "all",
        limit: "24",
      });
      const effectiveDepartment =
        department !== "all" ? department : serverQuery?.department;
      if (effectiveDepartment) params.set("department", effectiveDepartment);
      if (serverQuery?.q) params.set("q", serverQuery.q);
      if (availability.length)
        params.set("availability", availability.join(","));
      if (brands.length) params.set("brands", brands.join(","));
      if (signedIn && bands.length) params.set("priceBands", bands.join(","));
      if (cursor) params.set("cursor", cursor);
      setRemoteLoading(true);
      setRemoteError("");
      try {
        const page = await api<{
          products: Product[];
          total: number;
          nextCursor: string | null;
        }>(`/api/products?${params}`);
        if (version !== requestVersion.current) return;
        setRemoteProducts((current) =>
          append ? [...current, ...page.products] : page.products,
        );
        setRemoteTotal(page.total);
        setRemoteCursor(page.nextCursor);
        setRemoteLoaded(true);
      } catch (error) {
        if (version !== requestVersion.current) return;
        setRemoteError(
          error instanceof Error ? error.message : "Unable to load products.",
        );
        setRemoteLoaded(false);
      } finally {
        if (version === requestVersion.current) setRemoteLoading(false);
      }
    },
    [
      availability,
      bands,
      brands,
      department,
      effectiveSort,
      serverQuery?.collection,
      serverQuery?.department,
      serverQuery?.q,
      signedIn,
      useRemote,
    ],
  );

  useEffect(() => {
    if (useRemote) void fetchRemote();
  }, [fetchRemote, useRemote]);

  const sourceProducts = useRemote && remoteLoaded ? remoteProducts : products;
  const brandOptions = useMemo(
    () => [...new Set(sourceProducts.map((product) => product.brand))].sort(),
    [sourceProducts],
  );

  const results = useMemo(() => {
    if (useRemote) return sourceProducts;
    const activeBands = signedIn
      ? priceBands.filter((band) => bands.includes(band.id))
      : [];
    const filtered = products.filter((product) => {
      if (department !== "all" && product.categorySlug !== department)
        return false;
      if (availability.length && !availability.includes(product.availability))
        return false;
      if (brands.length && !brands.includes(product.brand)) return false;
      if (
        activeBands.length &&
        !activeBands.some((band) => band.test(product.price))
      )
        return false;
      return true;
    });

    const sorted = [...filtered];
    switch (effectiveSort) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        sorted.sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort(
          (a, b) =>
            Number(b.featured) - Number(a.featured) ||
            b.rating - a.rating ||
            a.name.localeCompare(b.name),
        );
    }
    return sorted;
  }, [
    products,
    sourceProducts,
    useRemote,
    department,
    availability,
    bands,
    brands,
    effectiveSort,
    signedIn,
  ]);

  /**
   * The grid only ever receives viewer-scoped DTOs — an anonymous visitor's
   * rendered cards contain no monetary fields, per the price-privacy rule.
   */
  const rendered = useMemo(
    () => toViewerProducts(results, { pricesVisible: signedIn }),
    [results, signedIn],
  );
  const renderedPage = useRemote ? rendered : rendered.slice(0, page * 24);

  useEffect(() => {
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (department === "all") params.delete("department");
    else params.set("department", department);
    if (effectiveSort === "featured") params.delete("sort");
    else params.set("sort", effectiveSort);
    if (availability.length) params.set("availability", availability.join(","));
    else params.delete("availability");
    if (brands.length) params.set("brands", brands.join(","));
    else params.delete("brands");
    if (signedIn && bands.length) params.set("priceBands", bands.join(","));
    else params.delete("priceBands");
    const next = params.toString();
    if (next !== searchParams.toString())
      router.replace(next ? `?${next}` : "?", { scroll: false });
  }, [
    availability,
    bands,
    brands,
    department,
    effectiveSort,
    router,
    searchParams,
    signedIn,
  ]);

  const categoryName = (slug: string) =>
    departments?.find((item) => item.slug === slug)?.name ?? "";

  const filterCount =
    availability.length +
    (signedIn ? bands.length : 0) +
    brands.length +
    (department !== "all" ? 1 : 0);

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) {
    setter(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value],
    );
  }

  function reset() {
    setDepartment("all");
    setAvailability([]);
    setBands([]);
    setBrands([]);
  }

  return (
    <div className="wrap catalog-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`}>
            {crumb.href ? (
              <Link href={crumb.href}>{crumb.label}</Link>
            ) : (
              <strong>{crumb.label}</strong>
            )}
            {index < crumbs.length - 1 ? " /" : ""}
          </span>
        ))}
      </nav>

      <header className="catalog-hero">
        <span className="kicker green">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      {departments?.length ? (
        <div
          className="filter-chips"
          role="group"
          aria-label="Filter by department"
        >
          <button
            type="button"
            className={department === "all" ? "active" : undefined}
            onClick={() => setDepartment("all")}
          >
            All departments
          </button>
          {departments.map((item) => (
            <button
              key={item.slug}
              type="button"
              className={department === item.slug ? "active" : undefined}
              onClick={() => setDepartment(item.slug)}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="catalog-toolbar">
        <span>
          {plural(
            useRemote && remoteLoaded ? remoteTotal : results.length,
            "product",
          )}{" "}
          ·{" "}
          {useRemote
            ? "server-filtered"
            : `${plural(products.length, "result")} in this view`}
        </span>
        <label>
          Sort by
          <select
            value={effectiveSort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            {visibleSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="catalog-filter-trigger"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersIcon /> Filters{filterCount ? ` (${filterCount})` : ""}
        </button>
      </div>

      <div className="catalog-layout">
        <aside
          className={filtersOpen ? "catalog-filters open" : "catalog-filters"}
          aria-label="Filters"
        >
          <div className="catalog-filter-head">
            <strong>Filter products</strong>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            >
              ×
            </button>
          </div>
          <SlidersIcon />
          <strong>Filters{filterCount ? ` (${filterCount})` : ""}</strong>

          <span>Availability</span>
          {availabilityOrder.map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={availability.includes(value)}
                onChange={() => toggle(availability, value, setAvailability)}
              />
              {availabilityMeta[value].label}
            </label>
          ))}

          {signedIn ? (
            <>
              <hr />

              <span>Price</span>
              {priceBands.map((band) => (
                <label key={band.id}>
                  <input
                    type="checkbox"
                    checked={bands.includes(band.id)}
                    onChange={() => toggle(bands, band.id, setBands)}
                  />
                  {band.label}
                </label>
              ))}
            </>
          ) : null}

          {brandOptions.length > 1 ? (
            <>
              <hr />
              <span>Brand</span>
              {brandOptions.map((brand) => (
                <label key={brand}>
                  <input
                    type="checkbox"
                    checked={brands.includes(brand)}
                    onChange={() => toggle(brands, brand, setBrands)}
                  />
                  {brand}
                </label>
              ))}
            </>
          ) : null}

          <hr />
          <button
            type="button"
            className="catalog-clear"
            onClick={reset}
            disabled={!filterCount}
          >
            Clear filters
          </button>
          <button
            type="button"
            className="catalog-apply"
            onClick={() => setFiltersOpen(false)}
          >
            Show {plural(results.length, "product")}
          </button>
        </aside>
        {filtersOpen ? (
          <button
            type="button"
            className="sheet-backdrop"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
        ) : null}

        <div>
          {remoteError ? <p className="form-error">{remoteError}</p> : null}
          {results.length ? (
            <div className="product-grid catalog-grid">
              {renderedPage.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryName={categoryName(product.categorySlug)}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <SlidersIcon />
              <h3>{emptyTitle}</h3>
              <p>{emptyMessage}</p>
              <Link href="/request-product">Request a product instead</Link>
            </div>
          )}
          {useRemote && remoteCursor ? (
            <button
              className="catalog-apply"
              type="button"
              disabled={remoteLoading}
              onClick={() => void fetchRemote(remoteCursor, true)}
            >
              {remoteLoading ? "Loading…" : "Load more products"}
            </button>
          ) : !useRemote && renderedPage.length < rendered.length ? (
            <button
              className="catalog-apply"
              type="button"
              onClick={() => setPage((value) => value + 1)}
            >
              Load more products
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
