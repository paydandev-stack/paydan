"use client";
import Image from "@/components/safe-image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSearch,
  AdminSelect,
  AdminTable,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { money, plural } from "@/lib/format";
import { availabilityMeta, productStatusMeta } from "@/lib/status";
/** Gross margin from list price and internal unit cost, never shown to shoppers. */
function marginPercent(price: number, costPrice: number): number | null {
  if (price <= 0) return null;
  return Math.round(((price - costPrice) / price) * 100);
}
/** Catalogue table: search, status/category filters, margin view and status controls. */
export default function AdminProductsPage() {
  const { state, actions } = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return state.products.filter((product) => {
      if (status !== "all" && product.status !== status) return false;
      if (category !== "all" && product.categorySlug !== category) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term)
      );
    });
  }, [state.products, query, status, category]);
  const published = state.products.filter(
    (product) => product.status === "published",
  );
  const drafts = state.products.filter((product) => product.status === "draft");
  const archived = state.products.filter(
    (product) => product.status === "archived",
  );
  const priced = state.products.filter((product) => product.price > 0);
  const averageMargin = priced.length
    ? Math.round(
        priced.reduce(
          (sum, product) =>
            sum + ((product.price - product.costPrice) / product.price) * 100,
          0,
        ) / priced.length,
      )
    : 0;
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Products"
        description={`${plural(state.products.length, "listing")} in the catalogue · unit costs and margins below are internal only`}
        action={
          <Link className="admin-btn" href="/admin/products/new">
            New product
          </Link>
        }
      />

      <AdminKpis
        items={[
          {
            label: "Products",
            value: state.products.length,
            note: `${filtered.length} match the filters`,
          },
          {
            label: "Published",
            value: published.length,
            note: "Live on the storefront",
          },
          {
            label: "Drafts",
            value: drafts.length,
            note: "Hidden from shoppers",
          },
          {
            label: "Archived",
            value: archived.length,
            note: "Kept for history",
          },
          {
            label: "Average margin",
            value: `${averageMargin}%`,
            note: "Gross, from unit cost",
          },
          {
            label: "Categories",
            value: state.categories.length,
            note: `${state.vendors.length} vendors in the network`,
          },
        ]}
      />

      <div className="admin-filters">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search name, SKU or brand…"
          label="Search products by name, SKU or brand"
        />
        <AdminSelect
          label="Filter by product status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <AdminSelect
          label="Filter by category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "All categories" },
            ...state.categories.map((item) => ({
              value: item.slug,
              label: item.name,
            })),
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <AdminEmpty
          title="No products match these filters"
          hint="Clear the search box or widen the status and category filters to see more of the catalogue."
        />
      ) : (
        <AdminTable
          template=".9fr 1.1fr 1fr 1.1fr .9fr"
          head={[
            "Product",
            "Category",
            "Price & margin",
            "Status & availability",
            "Actions",
          ]}
          caption="Products matching the current filters"
        >
          {filtered.map((product) => {
            const margin = marginPercent(product.price, product.costPrice);
            const categoryName =
              state.categories.find(
                (item) => item.slug === product.categorySlug,
              )?.name ?? product.categorySlug;
            return (
              <div className="table-row" key={product.id}>
                <span
                  style={{
                    display: "flex",
                    gap: ".6rem",
                    alignItems: "center",
                  }}
                >
                  {product.images[0] ? (
                    <Image
                      src={product.images[0]}
                      alt=""
                      width={34}
                      height={34}
                      style={{
                        width: 34,
                        height: 34,
                        objectFit: "cover",
                        borderRadius: ".35rem",
                        flex: "0 0 auto",
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{
                        display: "block",
                        width: 34,
                        height: 34,
                        borderRadius: ".35rem",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        flex: "0 0 auto",
                      }}
                    />
                  )}
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{product.name}</strong>
                    <small style={{ color: "var(--muted)" }}>
                      {product.sku}
                    </small>
                  </span>
                </span>
                <span>{categoryName}</span>
                <span>
                  <strong style={{ display: "block" }}>
                    {money(product.price)}
                  </strong>
                  <small style={{ color: "var(--muted)" }}>
                    Cost {money(product.costPrice)} ·{" "}
                    {margin === null ? "no margin" : `${margin}% margin`}
                  </small>
                </span>
                <span>
                  <StatusPill tone={productStatusMeta[product.status].tone}>
                    {productStatusMeta[product.status].label}
                  </StatusPill>
                  <small
                    style={{
                      display: "block",
                      marginTop: ".35rem",
                      color: "var(--muted)",
                    }}
                  >
                    {availabilityMeta[product.availability].label}
                  </small>
                </span>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ".4rem",
                    alignItems: "flex-start",
                  }}
                >
                  <Link
                    className="admin-btn quiet"
                    href={`/admin/products/${product.id}/edit`}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="admin-btn ghost"
                    onClick={async () => {
                      try {
                        return await actions.setProductStatus(
                          product.id,
                          product.status === "published"
                            ? "draft"
                            : "published",
                        );
                      } catch (error) {}
                    }}
                  >
                    {product.status === "published"
                      ? "Move to draft"
                      : "Publish"}
                  </button>
                </span>
              </div>
            );
          })}
        </AdminTable>
      )}
    </>
  );
}
