"use client";
import Image from "@/components/safe-image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { downloadCsv, parseCsv } from "@/lib/csv";
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
  const { state, actions, refresh } = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(50);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkVendor, setBulkVendor] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
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
  useEffect(() => setVisibleCount(50), [query, status, category]);
  useEffect(() => {
    const statusParam = new URLSearchParams(window.location.search).get(
      "status",
    );
    if (statusParam) setStatus(statusParam);
  }, []);
  const visibleProducts = filtered.slice(0, visibleCount);
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
  async function runBulk(name: string, args: unknown[], success: string) {
    if (!selected.length || bulkBusy) return;
    setBulkBusy(true);
    setNotice("");
    try {
      await api("/api/commands", {
        name,
        args,
        key: crypto.randomUUID(),
      });
      await refresh();
      setNotice(success);
      actions.notify(success, "success");
      setSelected([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed.";
      setNotice(message);
      actions.notify(message, "error");
    } finally {
      setBulkBusy(false);
    }
  }
  function exportProducts() {
    const rows = (
      selected.length
        ? state.products.filter((product) => selected.includes(product.id))
        : filtered
    ).map((product) => [
      product.name,
      product.sku,
      product.categorySlug,
      product.vendorId,
      product.price,
      product.costPrice,
      product.description,
      product.brand,
      product.status,
    ]);
    downloadCsv("paydan-products.csv", [
      [
        "name",
        "sku",
        "categorySlug",
        "vendorId",
        "price",
        "costPrice",
        "description",
        "brand",
        "status",
      ],
      ...rows,
    ]);
  }
  async function importProducts(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const rows = parseCsv(await file.text());
      const [header, ...data] = rows;
      const index = (name: string) => header.indexOf(name);
      const entries = data
        .map((row) => ({
          name: row[index("name")] ?? "",
          sku: row[index("sku")] ?? "",
          categorySlug: row[index("categorySlug")] ?? "",
          vendorId: row[index("vendorId")] ?? "",
          price: Number(row[index("price")]),
          costPrice: Number(row[index("costPrice")]),
          description: row[index("description")] || undefined,
          brand: row[index("brand")] || undefined,
        }))
        .filter((entry) => entry.name && entry.sku);
      if (!entries.length)
        throw new Error("The CSV must include name and sku columns.");
      setBulkBusy(true);
      setNotice("");
      await api("/api/commands", {
        name: "importProducts",
        args: [entries],
        key: crypto.randomUUID(),
      });
      await refresh();
      const message = "Imported " + entries.length + " draft products.";
      setNotice(message);
      actions.notify(message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setNotice(message);
      actions.notify(message, "error");
    } finally {
      setBulkBusy(false);
    }
  }
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

      <section
        className="admin-card bulk-toolbar"
        aria-label="Bulk catalogue actions"
      >
        <div className="bulk-toolbar-head">
          <strong>{selected.length} selected</strong>
          <span>
            Select products in the table to publish, archive, duplicate or
            reassign them. Exports use the current filters when nothing is
            selected.
          </span>
        </div>
        {notice ? <p role="status">{notice}</p> : null}
        <div className="admin-actions">
          <button
            className="admin-btn"
            disabled={!selected.length || bulkBusy}
            onClick={() =>
              void runBulk(
                "bulkProductStatus",
                [{ ids: selected, status: "published" }],
                "Selected products published.",
              )
            }
          >
            Publish selected
          </button>
          <button
            className="admin-btn secondary"
            disabled={!selected.length || bulkBusy}
            onClick={() =>
              void runBulk(
                "bulkProductStatus",
                [{ ids: selected, status: "draft" }],
                "Selected products moved to draft.",
              )
            }
          >
            Move to draft
          </button>
          <button
            className="admin-btn quiet"
            disabled={!selected.length || bulkBusy}
            onClick={() =>
              void runBulk(
                "bulkProductStatus",
                [{ ids: selected, status: "archived" }],
                "Selected products archived.",
              )
            }
          >
            Archive
          </button>
          <button
            className="admin-btn quiet"
            disabled={selected.length !== 1 || bulkBusy}
            onClick={() =>
              void runBulk(
                "duplicateProduct",
                [selected[0]],
                "Product duplicated as a draft.",
              )
            }
          >
            Duplicate
          </button>
          <label>
            Supplier
            <select
              value={bulkVendor}
              onChange={(event) => setBulkVendor(event.target.value)}
            >
              <option value="">Keep existing</option>
              {state.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select
              value={bulkCategory}
              onChange={(event) => setBulkCategory(event.target.value)}
            >
              <option value="">Keep existing</option>
              {state.categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="admin-btn secondary"
            disabled={
              !selected.length || bulkBusy || (!bulkVendor && !bulkCategory)
            }
            onClick={() =>
              void runBulk(
                "bulkReassignProducts",
                [
                  {
                    ids: selected,
                    vendorId: bulkVendor || undefined,
                    categorySlug: bulkCategory || undefined,
                  },
                ],
                "Selected products reassigned and moved to draft.",
              )
            }
          >
            Reassign
          </button>
          <label>
            Publish at
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
            />
          </label>
          <button
            className="admin-btn secondary"
            disabled={!selected.length || !scheduleAt || bulkBusy}
            onClick={() =>
              void runBulk(
                "scheduleProductPublish",
                [selected[0], new Date(scheduleAt).toISOString()],
                "Publish scheduled for the first selected product.",
              )
            }
          >
            Schedule
          </button>
          <button
            type="button"
            className="admin-btn quiet"
            onClick={exportProducts}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="admin-btn quiet"
            disabled={bulkBusy}
            onClick={() => importRef.current?.click()}
          >
            Import CSV
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => void importProducts(event)}
          />
        </div>
      </section>

      {filtered.length === 0 ? (
        <AdminEmpty
          title="No products match these filters"
          hint="Clear the search box or widen the status and category filters to see more of the catalogue."
        />
      ) : (
        <AdminTable
          template=".35fr .9fr 1.1fr 1fr 1.1fr .9fr"
          head={[
            "",
            "Product",
            "Category",
            "Price & margin",
            "Status & availability",
            "Actions",
          ]}
          caption="Products matching the current filters"
        >
          {visibleProducts.map((product) => {
            const margin = marginPercent(product.price, product.costPrice);
            const categoryName =
              state.categories.find(
                (item) => item.slug === product.categorySlug,
              )?.name ?? product.categorySlug;
            return (
              <div className="table-row" key={product.id}>
                <span>
                  <input
                    type="checkbox"
                    aria-label={"Select " + product.name}
                    checked={selected.includes(product.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, product.id]
                          : current.filter((id) => id !== product.id),
                      )
                    }
                  />
                </span>
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
      {visibleProducts.length < filtered.length ? (
        <div className="admin-actions" style={{ justifyContent: "center" }}>
          <button
            className="admin-btn quiet"
            type="button"
            onClick={() => setVisibleCount((count) => count + 50)}
          >
            Load 50 more products
          </button>
        </div>
      ) : null}
    </>
  );
}
