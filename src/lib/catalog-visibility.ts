import type { Category, Product, ProductVariant } from "./types";

export function isCustomerVisibleCategory(
  category: Pick<Category, "active" | "restricted"> | null | undefined,
) {
  return Boolean(category && category.active !== false && !category.restricted);
}

export function isCustomerVisibleProduct(
  product: Pick<Product, "status" | "restricted">,
  category: Pick<Category, "active" | "restricted"> | null | undefined,
) {
  return (
    product.status === "published" &&
    !product.restricted &&
    isCustomerVisibleCategory(category)
  );
}

export function isPurchasableVariant(
  product: Pick<Product, "status" | "restricted">,
  category: Pick<Category, "active" | "restricted"> | null | undefined,
  variant: Pick<ProductVariant, "availability"> | null | undefined,
) {
  return Boolean(
    variant &&
    variant.availability !== "out_of_stock" &&
    isCustomerVisibleProduct(product, category),
  );
}
