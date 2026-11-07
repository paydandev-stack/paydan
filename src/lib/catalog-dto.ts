import type { Product, ProductVariant } from "@/lib/types";

/**
 * Catalogue data transfer objects.
 *
 * Price privacy is an access rule, not a CSS rule: a guest-facing view must not
 * *receive* monetary fields at all, so a discounted price cannot leak through
 * markup, prefetch payloads, JSON-LD or the assistant's retrieval.
 *
 * Every shape here is built with an explicit field allowlist. `costPrice`,
 * `vendorId` and supplier relationships never appear in either DTO — those are
 * internal fields that must not reach any customer bundle.
 */

type Monetary = {
  /** Present only in member DTOs — never in a guest DTO. */
  price?: number;
  compareAt?: number;
};

/**
 * Brand marking an object as produced by this module. A raw seed `Product` is
 * structurally missing it, so passing an unmapped fixture into a customer-facing
 * component is a type error rather than something reviewers must remember.
 *
 * A plain string literal (not a `unique symbol`) so the marker survives
 * serialization if the DTO is ever passed across a server/client boundary.
 */
type Catalogured = { readonly __dto: "catalog" };

export type CatalogVariant = {
  id: string;
  sku: string;
  label: string;
  options: Record<string, string>;
  availability: ProductVariant["availability"];
} & Monetary &
  Catalogured;

export type CatalogProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  categorySlug: string;
  brand: string;
  images: string[];
  description: string;
  highlights: string[];
  specifications: Record<string, string>;
  availability: Product["availability"];
  variants: CatalogVariant[];
  status: Product["status"];
  featured: boolean;
  newArrival: boolean;
  restricted: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
} & Monetary &
  Catalogured;

const variantShape = (
  variant: ProductVariant,
  priced: boolean,
): CatalogVariant => ({
  __dto: "catalog",
  id: variant.id,
  sku: variant.sku,
  label: variant.label,
  options: variant.options,
  availability: variant.availability,
  ...(priced
    ? {
        price: variant.price,
        ...(variant.compareAt ? { compareAt: variant.compareAt } : {}),
      }
    : {}),
});

const productShape = (product: Product, priced: boolean): CatalogProduct => ({
  __dto: "catalog",
  id: product.id,
  slug: product.slug,
  sku: product.sku,
  name: product.name,
  categorySlug: product.categorySlug,
  brand: product.brand,
  images: product.images,
  description: product.description,
  highlights: product.highlights,
  specifications: product.specifications,
  availability: product.availability,
  variants: product.variants.map((variant) => variantShape(variant, priced)),
  status: product.status,
  featured: product.featured,
  newArrival: product.newArrival,
  restricted: product.restricted,
  rating: product.rating,
  reviewCount: product.reviewCount,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  ...(priced
    ? {
        price: product.price,
        ...(product.compareAt ? { compareAt: product.compareAt } : {}),
      }
    : {}),
});

/** Anonymous browsing: identity, imagery, copy and availability only. */
export function toPublicProduct(product: Product): CatalogProduct {
  return productShape(product, false);
}

export function toPublicProducts(products: Product[]): CatalogProduct[] {
  return products.map(toPublicProduct);
}

/**
 * Signed-in member: current prices are allowed, but internal cost and supplier
 * fields stay out of the object even for a member DTO.
 */
export function toMemberProduct(product: Product): CatalogProduct {
  return productShape(product, true);
}

export function toMemberProducts(products: Product[]): CatalogProduct[] {
  return products.map(toMemberProduct);
}

/** True when this object is allowed to carry money — the only price gate. */
export function pricesVisible(
  product: CatalogProduct,
): product is CatalogProduct & {
  price: number;
} {
  return typeof product.price === "number";
}

/**
 * Map a catalogue for the current viewer in one call, so a page cannot
 * accidentally hand a guest the priced shape.
 */
export function toViewerProducts(
  products: Product[],
  viewer: { pricesVisible: boolean },
): CatalogProduct[] {
  return viewer.pricesVisible
    ? toMemberProducts(products)
    : toPublicProducts(products);
}
