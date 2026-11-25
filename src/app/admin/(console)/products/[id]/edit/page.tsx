"use client";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { MediaUpload } from "@/components/media-upload";
import { api } from "@/lib/api-client";
import { getAdminRecords, putAdminRecord } from "@/lib/admin-records";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTextArea, AdminTextField } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/admin-controls";
import { formatDateTime, plural } from "@/lib/format";
import { readinessForForm } from "@/lib/product-readiness";
import { availabilityMeta, productStatusMeta } from "@/lib/status";
import type {
  Availability,
  Product,
  ProductStatus,
  ProductVariant,
} from "@/lib/types";
type VariantRow = {
  key: string;
  label: string;
  price: string;
  availability: Availability;
  sku: string;
  options: string;
};
type ProductForm = {
  name: string;
  sku: string;
  categorySlug: string;
  subcategorySlug: string;
  brand: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  price: string;
  compareAt: string;
  costPrice: string;
  availability: Availability;
  vendorId: string;
  status: ProductStatus;
  featured: boolean;
  newArrival: boolean;
  restricted: boolean;
  highlights: string;
  specifications: string;
  variants: VariantRow[];
};
type PublishSchedule = {
  id: string;
  productId: string;
  publishAt: string;
  status: "scheduled" | "published" | "blocked" | "cancelled";
  issues?: string[];
};
function rowKey(): string {
  return `r-${Math.random().toString(36).slice(2, 9)}`;
}
function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}
function parsePairs(value: string) {
  return Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...rest] = line.split(":");
        return [key.trim(), rest.join(":").trim()];
      })
      .filter(([key, value]) => key && value),
  );
}
function formatPairs(value: Record<string, string>) {
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${item}`)
    .join("\n");
}
function toForm(
  product: Product,
  vendors: {
    id: string;
  }[],
): ProductForm {
  return {
    name: product.name,
    sku: product.sku,
    categorySlug: product.categorySlug,
    subcategorySlug: product.subcategorySlug ?? "",
    brand: product.brand,
    description: product.description,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    price: String(product.price),
    compareAt: product.compareAt ? String(product.compareAt) : "",
    costPrice: String(product.costPrice),
    availability: product.availability,
    vendorId: vendors.some((item) => item.id === product.vendorId)
      ? product.vendorId
      : (vendors[0]?.id ?? ""),
    status: product.status,
    featured: product.featured,
    newArrival: product.newArrival,
    restricted: product.restricted,
    highlights: product.highlights.join("\n"),
    specifications: formatPairs(product.specifications),
    variants: product.variants.map((variant) => ({
      key: rowKey(),
      label: variant.label,
      price: String(variant.price),
      availability: variant.availability,
      sku: variant.sku,
      options: formatPairs(variant.options),
    })),
  };
}
function blankForm(categorySlug: string, vendorId: string): ProductForm {
  return {
    name: "",
    sku: "",
    categorySlug,
    subcategorySlug: "",
    brand: "",
    description: "",
    seoTitle: "",
    seoDescription: "",
    price: "",
    compareAt: "",
    costPrice: "",
    availability: "in_stock",
    vendorId,
    status: "draft",
    featured: false,
    newArrival: false,
    restricted: false,
    highlights: "",
    specifications: "",
    variants: [],
  };
}
/** Labeled select built from the same vocabulary as AdminTextField. */
function SelectField({
  label,
  hint,
  error,
  wide,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  error?: string;
  wide?: boolean;
  options: {
    value: string;
    label: string;
  }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={`admin-field${wide ? " wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="admin-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <small className="admin-field-error">{error}</small>
      ) : hint ? (
        <small>{hint}</small>
      ) : null}
    </div>
  );
}
const flagCopy: {
  key: "featured" | "newArrival" | "restricted";
  title: string;
  note: string;
}[] = [
  {
    key: "featured",
    title: "Featured",
    note: "Promoted on the storefront home page.",
  },
  {
    key: "newArrival",
    title: "New arrival",
    note: "Shown in the new arrivals rail.",
  },
  {
    key: "restricted",
    title: "Restricted (18+)",
    note: "Kept out of public browsing.",
  },
];
/** Edit an existing catalogue entry: same form as “new product”, plus archive. */
export default function AdminEditProductPage() {
  const params = useParams<{
    id: string;
  }>();
  const router = useRouter();
  const { state, actions } = useDemo();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const product = state.products.find((item) => item.id === idParam);
  const [form, setForm] = useState<ProductForm>(() =>
    product
      ? toForm(product, state.vendors)
      : blankForm(state.categories[0]?.slug ?? "", ""),
  );
  const [images, setImages] = useState<string[]>(() => product?.images ?? []);
  const [saving, setSaving] = useState(false);
  const [imageAlts, setImageAlts] = useState<Record<string, string>>(
    () => product?.imageAlts ?? {},
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  if (!product) notFound();
  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function setRow(key: string, patch: Partial<VariantRow>) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    }));
  }
  const formErrors = {
    name: form.name.trim() ? undefined : "Add a product name.",
    category: form.categorySlug ? undefined : "Choose a category.",
    vendorId: form.vendorId ? undefined : "Assign a supplying vendor.",
    price:
      parseAmount(form.price) !== null &&
      (parseAmount(form.price) as number) > 0
        ? undefined
        : "Add a selling price greater than zero.",
    compareAt:
      parseAmount(form.compareAt) === null ||
      (parseAmount(form.compareAt) as number) > (parseAmount(form.price) ?? 0)
        ? undefined
        : "Compare-at price must be higher than selling price.",
    costPrice:
      parseAmount(form.costPrice) !== null &&
      (parseAmount(form.costPrice) as number) > 0
        ? undefined
        : "Add the unit cost price.",
    description: form.description.trim() ? undefined : "Add a description.",
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      setSaving(true);
      const name = form.name.trim();
      const brand = form.brand.trim();
      const price = parseAmount(form.price);
      const costPrice = parseAmount(form.costPrice);
      const compareAt = parseAmount(form.compareAt);
      if (!name)
        return actions.notify("Add a product name before saving.", "error");
      if (!brand)
        return actions.notify("Add the brand shown to shoppers.", "error");
      if (!form.categorySlug)
        return actions.notify("Choose a category for this product.", "error");
      if (!form.vendorId)
        return actions.notify("Assign a supplying vendor.", "error");
      if (price === null || price <= 0) {
        return actions.notify(
          "Add a selling price greater than zero.",
          "error",
        );
      }
      if (costPrice === null || costPrice <= 0) {
        return actions.notify(
          "Add the unit cost price used for margin reporting.",
          "error",
        );
      }
      if (compareAt !== null && compareAt <= price) {
        return actions.notify(
          "The compare-at price must be higher than the selling price.",
          "error",
        );
      }
      const rows = form.variants.filter(
        (row) => row.label.trim() || row.price.trim(),
      );
      if (rows.some((row) => !row.label.trim())) {
        return actions.notify("Every variant row needs a label.", "error");
      }
      if (
        rows.some((row) => {
          const amount = parseAmount(row.price);
          return amount === null || amount <= 0;
        })
      ) {
        return actions.notify(
          "Every variant needs a price greater than zero.",
          "error",
        );
      }
      const sku = form.sku.trim() || product.sku;
      const now = new Date().toISOString();
      const variants: ProductVariant[] = rows.length
        ? rows.map((row, index) => ({
            id: product.variants[index]?.id ?? `${product.id}-v${index + 1}`,
            sku: row.sku.trim() || `${sku}-${index + 1}`,
            label: row.label.trim(),
            options: parsePairs(row.options),
            price: parseAmount(row.price) as number,
            availability: row.availability,
          }))
        : [
            {
              id: product.variants[0]?.id ?? `${product.id}-v1`,
              sku: product.variants[0]?.sku ?? `${sku}-1`,
              label: "Standard",
              options: {},
              price,
              availability: form.availability,
            },
          ];
      const updated: Product = {
        ...product,
        images,
        imageAlts,
        slug: product.slug,
        sku,
        name,
        categorySlug: form.categorySlug,
        subcategorySlug: form.subcategorySlug || undefined,
        brand,
        description: form.description.trim(),
        highlights: form.highlights
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        specifications: parsePairs(form.specifications),
        price,
        compareAt:
          compareAt !== null && compareAt > price ? compareAt : undefined,
        availability: form.availability,
        vendorId: form.vendorId,
        costPrice,
        variants,
        status: form.status,
        featured: form.featured,
        newArrival: form.newArrival,
        restricted: form.restricted,
        updatedAt: now,
      };
      await actions.saveProduct(updated);
      setConfirmArchive(false);
      set("status", updated.status);
      router.push("/admin/products");
    } catch (error) {
      actions.notify(
        error instanceof Error ? error.message : "Could not save product.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };
  const categoryName =
    state.categories.find((item) => item.slug === product.categorySlug)?.name ??
    product.categorySlug;
  const vendorName =
    state.vendors.find((item) => item.id === product.vendorId)?.name ??
    "Unassigned";
  const margin =
    product.price > 0
      ? Math.round(((product.price - product.costPrice) / product.price) * 100)
      : null;
  const readinessIssues = readinessForForm({
    images,
    description: form.description,
    price: parseAmount(form.price) ?? 0,
    costPrice: parseAmount(form.costPrice) ?? undefined,
    vendorId: form.vendorId,
    categorySlug: form.categorySlug,
    restricted: form.restricted,
    category: state.categories.find((item) => item.slug === form.categorySlug),
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title={product.name}
        description={`${product.sku} · ${categoryName} · supplied by ${vendorName} · last updated ${formatDateTime(product.updatedAt)}`}
        action={
          <Link className="admin-btn quiet" href="/admin/products">
            Back to products
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <MediaUpload
          title="Product photos"
          maxFiles={12}
          images={images}
          alts={imageAlts}
          onUploaded={(url) => setImages((current) => [...current, url])}
          onRemove={(url) =>
            setImages((current) => current.filter((item) => item !== url))
          }
          onAltChange={(url, alt) =>
            setImageAlts((current) => ({ ...current, [url]: alt }))
          }
          onMove={(from, to) =>
            setImages((current) => {
              const next = [...current];
              [next[from], next[to]] = [next[to], next[from]];
              return next;
            })
          }
        />
        <div className="admin-panels wide">
          <section className="admin-card">
            <h2>Listing details</h2>
            <div className="form-grid">
              <AdminTextField
                wide
                label="Product name"
                error={formErrors.name}
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
              />
              <AdminTextField
                label="SKU"
                value={form.sku}
                onChange={(event) => set("sku", event.target.value)}
                hint="Cleared values fall back to the saved SKU."
              />
              <AdminTextField
                label="Brand"
                value={form.brand}
                onChange={(event) => set("brand", event.target.value)}
              />
              <SelectField
                label="Category"
                error={formErrors.category}
                value={form.categorySlug}
                onChange={(value) => {
                  set("categorySlug", value);
                  set("subcategorySlug", "");
                }}
                options={state.categories.map((item) => ({
                  value: item.slug,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Subcategory"
                value={form.subcategorySlug}
                onChange={(value) => set("subcategorySlug", value)}
                options={[
                  { value: "", label: "No subcategory" },
                  ...(state.categories
                    .find((item) => item.slug === form.categorySlug)
                    ?.subcategories.map((item) => ({
                      value: item.slug,
                      label: item.name,
                    })) ?? []),
                ]}
              />
              <SelectField
                label="Product vendor"
                error={formErrors.vendorId}
                value={form.vendorId}
                onChange={(value) => set("vendorId", value)}
                options={state.vendors.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                hint="The selected vendor name appears on the storefront product card."
              />
              <AdminTextField
                label="Price (₦)"
                error={formErrors.price}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.price}
                onChange={(event) => set("price", event.target.value)}
              />
              <AdminTextField
                label="Compare-at price (₦)"
                error={formErrors.compareAt}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.compareAt}
                onChange={(event) => set("compareAt", event.target.value)}
                hint="Optional. Must sit above the selling price."
              />
              <AdminTextField
                label="Unit cost price (₦)"
                error={formErrors.costPrice}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.costPrice}
                onChange={(event) => set("costPrice", event.target.value)}
                hint="Internal only — drives margin reporting."
              />
              <SelectField
                label="Availability"
                value={form.availability}
                onChange={(value) => set("availability", value as Availability)}
                options={(Object.keys(availabilityMeta) as Availability[]).map(
                  (key) => ({
                    value: key,
                    label: availabilityMeta[key].label,
                  }),
                )}
              />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(value) => set("status", value as ProductStatus)}
                options={(
                  Object.keys(productStatusMeta) as ProductStatus[]
                ).map((key) => ({
                  value: key,
                  label: productStatusMeta[key].label,
                }))}
                hint="Saved with the form — archive below is immediate."
              />
              <AdminTextArea
                wide
                label="Description"
                rows={4}
                error={formErrors.description}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
              />
              <AdminTextField
                wide
                label="SEO title"
                value={form.seoTitle}
                maxLength={70}
                placeholder="Defaults to the product name when left blank"
                onChange={(event) => set("seoTitle", event.target.value)}
              />
              <AdminTextArea
                wide
                label="SEO description"
                rows={3}
                maxLength={160}
                value={form.seoDescription}
                placeholder="A short search-result summary for this product"
                onChange={(event) => set("seoDescription", event.target.value)}
              />
              <AdminTextArea
                wide
                label="Specifications"
                rows={5}
                value={form.specifications}
                onChange={(event) => set("specifications", event.target.value)}
                hint="One per line as Label: Value."
              />
            </div>
          </section>

          <section className="admin-card">
            <h2>Merchandising</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".7rem" }}>
              {flagCopy.map((flag) => (
                <label
                  key={flag.key}
                  className={`choice${form[flag.key] ? " active" : ""}`}
                  style={{ flex: "1 1 14rem", margin: 0 }}
                >
                  <input
                    type="checkbox"
                    checked={form[flag.key]}
                    onChange={(event) => set(flag.key, event.target.checked)}
                  />
                  <span>
                    {flag.title}
                    <small>{flag.note}</small>
                  </span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: "1rem" }}>
              <AdminTextArea
                wide
                label="Highlights"
                rows={4}
                value={form.highlights}
                onChange={(event) => set("highlights", event.target.value)}
                hint="One per line — shown as bullet points on the product page."
              />
            </div>
          </section>

          <section className="admin-card">
            <h2>Variants</h2>
            <p>
              Each row sells on its own price and stock state. Rows left empty
              keep a single “Standard” option built from the price above.
            </p>
            {form.variants.map((row) => (
              <div
                key={row.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr .8fr 1fr 1fr 1.4fr auto",
                  gap: ".6rem",
                  alignItems: "end",
                  marginBottom: ".6rem",
                }}
              >
                <AdminTextField
                  label="Label"
                  value={row.label}
                  placeholder="e.g. 250ml"
                  onChange={(event) =>
                    setRow(row.key, { label: event.target.value })
                  }
                />
                <AdminTextField
                  label="Price (₦)"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={row.price}
                  onChange={(event) =>
                    setRow(row.key, { price: event.target.value })
                  }
                />
                <SelectField
                  label="Availability"
                  value={row.availability}
                  onChange={(value) =>
                    setRow(row.key, { availability: value as Availability })
                  }
                  options={(
                    Object.keys(availabilityMeta) as Availability[]
                  ).map((key) => ({
                    value: key,
                    label: availabilityMeta[key].label,
                  }))}
                />
                <AdminTextField
                  label="SKU"
                  value={row.sku}
                  placeholder="Optional"
                  onChange={(event) =>
                    setRow(row.key, { sku: event.target.value })
                  }
                />
                <AdminTextField
                  label="Options"
                  value={row.options}
                  placeholder="Colour: Black"
                  hint={
                    state.categories.find(
                      (item) => item.slug === form.categorySlug,
                    )?.facets.length
                      ? `Facets: ${state.categories
                          .find((item) => item.slug === form.categorySlug)!
                          .facets.join(", ")}`
                      : "One per line as Label: Value"
                  }
                  onChange={(event) =>
                    setRow(row.key, { options: event.target.value })
                  }
                />
                <button
                  type="button"
                  className="admin-btn quiet"
                  style={{ height: "2.5rem" }}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      variants: current.variants.filter(
                        (item) => item.key !== row.key,
                      ),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="admin-btn ghost"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  variants: [
                    ...current.variants,
                    {
                      key: rowKey(),
                      label: "",
                      price: "",
                      availability: "in_stock",
                      sku: "",
                      options: "",
                    },
                  ],
                }))
              }
            >
              Add variant
            </button>
          </section>

          <section className="admin-card">
            <h2>Record</h2>
            <div className="admin-meta">
              <div>
                <span>Product ID</span>
                <strong>{product.id}</strong>
              </div>
              <div>
                <span>Slug</span>
                <strong>{product.slug}</strong>
              </div>
              <div>
                <span>Created</span>
                <strong>{formatDateTime(product.createdAt)}</strong>
              </div>
              <div>
                <span>Gross margin</span>
                <strong>{margin === null ? "—" : `${margin}%`}</strong>
              </div>
              <div>
                <span>Rating</span>
                <strong>
                  {product.rating} / 5 · {plural(product.reviewCount, "review")}
                </strong>
              </div>
            </div>

            {product.status === "archived" ? (
              <div className="admin-actions" style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  className="admin-btn ghost"
                  onClick={async () => {
                    try {
                      await actions.setProductStatus(product.id, "draft");
                      set("status", "draft");
                    } catch (error) {}
                  }}
                >
                  Restore to draft
                </button>
              </div>
            ) : confirmArchive ? (
              <div className="admin-note" style={{ marginTop: "1rem" }}>
                Archive “{product.name}”? It leaves the storefront but stays in
                the catalogue and in past orders.
                <div className="admin-actions" style={{ marginTop: ".7rem" }}>
                  <button
                    type="button"
                    className="admin-btn danger"
                    onClick={async () => {
                      try {
                        await actions.setProductStatus(product.id, "archived");
                        set("status", "archived");
                        setConfirmArchive(false);
                      } catch (error) {}
                    }}
                  >
                    Archive product
                  </button>
                  <button
                    type="button"
                    className="admin-btn quiet"
                    onClick={() => setConfirmArchive(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-actions" style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={() => setConfirmArchive(true)}
                >
                  Archive product
                </button>
              </div>
            )}
          </section>
        </div>

        {readinessIssues.length > 0 ? (
          <div className="admin-note" style={{ marginBottom: "1rem" }}>
            <strong>Publish readiness</strong>
            <ul style={{ margin: "0.5rem 0 0 1.2rem", padding: 0 }}>
              {readinessIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="admin-notice" style={{ marginBottom: "1rem" }}>
            Ready to publish.
          </div>
        )}

        <div className="admin-sticky-actions">
          <span className="admin-form-state" role="status">
            {saving
              ? "Saving changes…"
              : form.status === "published"
                ? "Live on storefront"
                : "Draft"}
          </span>
          <Link className="admin-btn quiet" href="/admin/products">
            Cancel
          </Link>
          <button
            type="submit"
            className="admin-btn secondary"
            disabled={saving}
            onClick={() => set("status", "draft")}
          >
            Save draft
          </button>
          <button
            type="submit"
            className="admin-btn primary"
            disabled={saving}
            onClick={() => set("status", "published")}
          >
            Save & publish
          </button>
        </div>
      </form>
    </>
  );
}
