"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { MediaUpload } from "@/components/media-upload";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTextArea, AdminTextField } from "@/components/admin/data-table";
import { slugify } from "@/lib/format";
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
  initialStock: string;
  stockReason: string;
};
type ProductForm = {
  name: string;
  sku: string;
  categorySlug: string;
  subcategorySlug: string;
  brand: string;
  description: string;
  price: string;
  compareAt: string;
  costPrice: string;
  availability: Availability;
  vendorId: string;
  fulfillmentLocationId: string;
  status: ProductStatus;
  featured: boolean;
  newArrival: boolean;
  restricted: boolean;
  highlights: string;
  specifications: string;
  variants: VariantRow[];
  initialStock: string;
  stockReason: string;
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
/** Labeled select built from the same vocabulary as AdminTextField. */
function SelectField({
  label,
  hint,
  wide,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
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
      {hint ? <small>{hint}</small> : null}
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
/** Blank catalogue form used by the new-product route. */
export default function AdminNewProductPage() {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const router = useRouter();
  const { state, actions } = useDemo();
  const [form, setForm] = useState<ProductForm>({
    name: "",
    sku: "",
    categorySlug: state.categories[0]?.slug ?? "",
    subcategorySlug: "",
    brand: "",
    description: "",
    price: "",
    compareAt: "",
    costPrice: "",
    availability: "in_stock",
    vendorId: state.vendors[0]?.id ?? "",
    fulfillmentLocationId: "",
    status: "draft",
    featured: false,
    newArrival: false,
    restricted: false,
    highlights: "",
    specifications: "",
    variants: [],
    initialStock: "0",
    stockReason: "Initial product setup",
  });
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
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      const id = `p-${Date.now()}`;
      const slug = slugify(name);
      const sku =
        form.sku.trim() ||
        `PD-${slug.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();
      const variants: ProductVariant[] = rows.length
        ? rows.map((row, index) => ({
            id: `${id}-v${index + 1}`,
            sku: row.sku.trim() || `${sku}-${index + 1}`,
            label: row.label.trim(),
            options: parsePairs(row.options),
            price: parseAmount(row.price) as number,
            availability: row.availability,
          }))
        : [
            {
              id: `${id}-v1`,
              sku: `${sku}-1`,
              label: "Standard",
              options: {},
              price,
              availability: form.availability,
            },
          ];
      const product: Product = {
        id,
        slug,
        sku,
        name,
        categorySlug: form.categorySlug,
        subcategorySlug: form.subcategorySlug || undefined,
        brand,
        images: uploadedImages,
        imageAlts: Object.fromEntries(uploadedImages.map((url) => [url, name])),
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
        fulfillmentLocationId: form.fulfillmentLocationId || undefined,
        costPrice,
        variants,
        status: form.status,
        featured: form.featured,
        newArrival: form.newArrival,
        restricted: form.restricted,
        rating: 0,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      if (!uploadedImages.length)
        return actions.notify("Upload at least one product image.", "error");
      const initialStock = rows.length
        ? rows.map((row, index) => ({
            variantId: variants[index].id,
            available: Number(row.initialStock),
            reason: row.stockReason.trim(),
          }))
        : [
            {
              variantId: variants[0].id,
              available: Number(form.initialStock),
              reason: form.stockReason.trim(),
            },
          ];
      if (
        initialStock.some(
          (stock) =>
            !Number.isInteger(stock.available) ||
            stock.available < 0 ||
            stock.reason.length < 3,
        )
      )
        return actions.notify(
          "Add a whole-number initial stock and a reason for every variant.",
          "error",
        );
      await actions.createProduct({ product, initialStock });
      actions.notify(
        form.status === "published"
          ? `${name} saved and live on the storefront.`
          : `${name} saved as ${productStatusMeta[form.status].label.toLowerCase()}.`,
      );
      router.push("/admin/products");
    } catch {
      // The shared command runner already reports the server error once.
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="New product"
        description="Listing copy, pricing, internal cost and variants for one catalogue entry."
        action={
          <Link className="admin-btn quiet" href="/admin/products">
            Back to products
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <MediaUpload
          images={uploadedImages}
          onBusyChange={setUploadBusy}
          onUploaded={(url) => setUploadedImages((images) => [...images, url])}
          onRemove={(url) =>
            setUploadedImages((images) =>
              images.filter((image) => image !== url),
            )
          }
        />
        <div className="admin-panels wide">
          <section className="admin-card">
            <h2>Listing details</h2>
            <div className="form-grid">
              <AdminTextField
                wide
                label="Product name"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="e.g. Everyday Pantry Value Pack"
              />
              <AdminTextField
                label="SKU"
                value={form.sku}
                onChange={(event) => set("sku", event.target.value)}
                hint="Leave blank to generate one."
              />
              <AdminTextField
                label="Brand"
                value={form.brand}
                onChange={(event) => set("brand", event.target.value)}
              />
              <SelectField
                label="Category"
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
                value={form.vendorId}
                onChange={(value) => {
                  set("vendorId", value);
                  set("fulfillmentLocationId", "");
                }}
                options={state.vendors.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                hint="The selected vendor name appears on the storefront product card."
              />
              <SelectField
                label="Fulfilment location"
                value={form.fulfillmentLocationId}
                onChange={(value) => set("fulfillmentLocationId", value)}
                options={[
                  { value: "", label: "Vendor primary location" },
                  ...(state.vendors
                    .find((item) => item.id === form.vendorId)
                    ?.fulfillmentLocations?.filter(
                      (location) => location.active,
                    )
                    .map((location) => ({
                      value: location.id,
                      label: `${location.label} · ${location.city}, ${location.state}`,
                    })) ?? []),
                ]}
                hint="Optional override for vendors with multiple warehouses."
              />
              <AdminTextField
                label="Price (₦)"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.price}
                onChange={(event) => set("price", event.target.value)}
              />
              <AdminTextField
                label="Compare-at price (₦)"
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
                hint="Drafts stay hidden until published."
              />
              <AdminTextArea
                wide
                label="Description"
                rows={4}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
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
              produce a single “Standard” option built from the price above.
            </p>
            {form.variants.length === 0 ? (
              <div className="form-grid" style={{ marginBottom: "1rem" }}>
                <AdminTextField
                  label="Initial confirmed stock"
                  type="number"
                  min={0}
                  step={1}
                  value={form.initialStock}
                  onChange={(event) => set("initialStock", event.target.value)}
                />
                <AdminTextField
                  label="Stock reason"
                  value={form.stockReason}
                  onChange={(event) => set("stockReason", event.target.value)}
                  hint="Required for the opening inventory audit."
                />
              </div>
            ) : null}
            {form.variants.map((row) => (
              <div
                key={row.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
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
                <AdminTextField
                  label="Initial stock"
                  type="number"
                  min={0}
                  step={1}
                  value={row.initialStock}
                  onChange={(event) =>
                    setRow(row.key, { initialStock: event.target.value })
                  }
                />
                <AdminTextField
                  label="Stock reason"
                  value={row.stockReason}
                  onChange={(event) =>
                    setRow(row.key, { stockReason: event.target.value })
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
                      initialStock: "0",
                      stockReason: "Initial product setup",
                    },
                  ],
                }))
              }
            >
              Add variant
            </button>
          </section>
        </div>

        <div className="admin-sticky-actions">
          <span className="admin-form-state" role="status">
            {saving
              ? "Saving product…"
              : form.status === "published"
                ? "Ready to publish"
                : "Draft ready"}
          </span>
          <Link className="admin-btn quiet" href="/admin/products">
            Cancel
          </Link>
          <button
            type="submit"
            className="admin-btn secondary"
            disabled={saving || uploadBusy}
            onClick={() => set("status", "draft")}
          >
            Save draft
          </button>
          <button
            type="submit"
            className="admin-btn primary"
            disabled={saving || uploadBusy}
            onClick={() => set("status", "published")}
          >
            Publish product
          </button>
        </div>
      </form>
    </>
  );
}
