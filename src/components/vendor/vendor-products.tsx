"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
import type { VendorProduct } from "@/server/vendor";
import { MediaUpload } from "@/components/media-upload";
import { CloseIcon, PackageIcon, SearchIcon } from "@/components/icons";

type Draft = {
  name: string;
  description: string;
  images: string[];
  highlights: string;
  specifications: string;
  stock: Record<string, string>;
};

function toDraft(product: VendorProduct): Draft {
  return {
    name: product.name,
    description: product.description,
    images: [...product.images],
    highlights: product.highlights.join("\n"),
    specifications: Object.entries(product.specifications)
      .map(([key, value]) => key + " = " + value)
      .join("\n"),
    stock: Object.fromEntries(
      product.variants.map((variant) => [
        variant.id,
        String(product.variantStock[variant.id] ?? 0),
      ]),
    ),
  };
}

function list(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function pairs(value: string) {
  return Object.fromEntries(
    list(value)
      .map((line) => line.split("="))
      .filter((parts) => parts.length >= 2)
      .map((parts) => [parts[0].trim(), parts.slice(1).join("=").trim()]),
  );
}

function requestKey(name: string, id: string) {
  return name + ":" + id + ":" + Date.now() + ":" + Math.random();
}

export function VendorProducts({ products }: { products: VendorProduct[] }) {
  const router = useRouter();
  const { actions } = useDemo();
  const [items, setItems] = useState(products);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? items.filter((item) =>
          [item.name, item.sku, item.description]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : items;
  }, [items, query]);

  function start(product: VendorProduct) {
    setEditing(product.id);
    setDraft(toDraft(product));
    setError("");
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save(event: FormEvent, product: VendorProduct) {
    event.preventDefault();
    if (!draft || busy) return;
    if (!draft.name.trim()) {
      setError("Give the product a name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const patch = {
        name: draft.name.trim(),
        description: draft.description,
        images: draft.images,
        highlights: list(draft.highlights),
        specifications: pairs(draft.specifications),
      };
      await api("/api/commands", {
        name: "saveVendorProduct",
        args: [{ id: product.id }, patch],
        key: requestKey("saveVendorProduct", product.id),
      });
      for (const variant of product.variants) {
        const value = Number(draft.stock[variant.id] ?? 0);
        if (!Number.isFinite(value) || value < 0)
          throw new Error("Stock quantities cannot be negative.");
        await api("/api/commands", {
          name: "saveVendorStock",
          args: [
            {
              productId: product.id,
              variantId: variant.id,
              available: Math.floor(value),
            },
          ],
          key: requestKey("saveVendorStock", variant.id),
        });
      }
      setItems((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                ...patch,
                stock: product.variants.reduce(
                  (sum, variant) =>
                    sum +
                    Math.max(
                      0,
                      Math.floor(Number(draft.stock[variant.id] ?? 0)),
                    ),
                  0,
                ),
              }
            : item,
        ),
      );
      setEditing(null);
      setDraft(null);
      actions.notify("Product details and stock saved.", "success");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save changes.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="vendor-panel vendor-catalogue">
      <div className="vendor-panel-head">
        <div>
          <h2>Assigned products</h2>
          <p>
            Update product copy, images, highlights, specifications and stock.
          </p>
        </div>
        <label className="vendor-search">
          <SearchIcon aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your catalogue"
            aria-label="Search your catalogue"
          />
        </label>
      </div>

      {visible.length ? (
        <div className="vendor-product-grid">
          {visible.map((product) => (
            <article className="vendor-product-card" key={product.id}>
              <div className="vendor-product-media">
                {product.images[0] ? (
                  <img src={product.images[0]} alt={product.name} />
                ) : (
                  <PackageIcon aria-hidden="true" />
                )}
                <span className="vendor-status">{product.status}</span>
              </div>
              <div className="vendor-product-body">
                <div className="vendor-product-title">
                  <div>
                    <h3>{product.name}</h3>
                    <small>{product.sku}</small>
                  </div>
                  <strong>₦{product.price.toLocaleString("en-NG")}</strong>
                </div>
                <p>{product.description || "No description added yet."}</p>
                <div className="vendor-variant-list">
                  {product.variants.length ? (
                    product.variants.map((variant) => (
                      <div key={variant.id}>
                        <span>{variant.label}</span>
                        <small>{variant.sku}</small>
                      </div>
                    ))
                  ) : (
                    <small>No variants configured</small>
                  )}
                </div>
                <div className="vendor-product-foot">
                  <span>{product.stock} units in stock</span>
                  <button type="button" onClick={() => start(product)}>
                    Edit details
                  </button>
                </div>
              </div>

              {editing === product.id && draft ? (
                <form
                  className="vendor-edit-form"
                  onSubmit={(event) => save(event, product)}
                >
                  <div className="vendor-form-head">
                    <div>
                      <h4>Edit {product.name}</h4>
                      <p>Changes are saved to the live PAYDAN catalogue.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setDraft(null);
                        setError("");
                      }}
                      aria-label="Close editor"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <div className="vendor-fields">
                    <label className="wide">
                      Product name
                      <input
                        value={draft.name}
                        maxLength={160}
                        onChange={(event) =>
                          setField("name", event.target.value)
                        }
                      />
                    </label>
                    <label className="wide">
                      Description
                      <textarea
                        rows={3}
                        value={draft.description}
                        onChange={(event) =>
                          setField("description", event.target.value)
                        }
                      />
                    </label>
                    <div className="wide">
                      <MediaUpload
                        title="Product images"
                        purpose="catalog"
                        multiple
                        maxFiles={12}
                        images={draft.images}
                        onUploaded={(url) =>
                          setField("images", [...draft.images, url])
                        }
                        onRemove={(url) =>
                          setField(
                            "images",
                            draft.images.filter((image) => image !== url),
                          )
                        }
                        onMove={(from, to) => {
                          const images = [...draft.images];
                          const [moved] = images.splice(from, 1);
                          images.splice(to, 0, moved);
                          setField("images", images);
                        }}
                      />
                    </div>
                    <label>
                      Highlights <small>one per line</small>
                      <textarea
                        rows={3}
                        value={draft.highlights}
                        onChange={(event) =>
                          setField("highlights", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Specifications <small>Key = value, one per line</small>
                      <textarea
                        rows={3}
                        value={draft.specifications}
                        onChange={(event) =>
                          setField("specifications", event.target.value)
                        }
                      />
                    </label>
                    {product.variants.map((variant) => (
                      <label key={variant.id}>
                        Stock · {variant.label}
                        <input
                          type="number"
                          min={0}
                          max={1000000}
                          value={draft.stock[variant.id] ?? "0"}
                          onChange={(event) =>
                            setField("stock", {
                              ...draft.stock,
                              [variant.id]: event.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  {error ? <p className="vendor-error">{error}</p> : null}
                  <div className="vendor-form-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setDraft(null);
                        setError("");
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={busy}>
                      {busy ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="vendor-empty">
          <strong>
            {query ? "No matching products" : "No products assigned"}
          </strong>
          <p>
            {query
              ? "Try another name or SKU."
              : "Ask PAYDAN operations to assign products to your supplier account."}
          </p>
        </div>
      )}
    </section>
  );
}
