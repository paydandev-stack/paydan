/** Client-safe publish checks shared with the server-side catalogue gate. */
export function readinessForForm(product: {
  images?: string[];
  description?: string;
  price?: number;
  costPrice?: number;
  vendorId?: string;
  categorySlug?: string;
  restricted?: boolean;
  category?: { active?: boolean; restricted?: boolean };
  stock?: number;
}): string[] {
  const issues: string[] = [];
  if (!product.images?.length) issues.push("Add at least one product image.");
  if (!product.description?.trim()) issues.push("Add a description.");
  if (!((product.price ?? 0) > 0)) issues.push("Set a price above zero.");
  if (product.costPrice === undefined || !(product.costPrice >= 0))
    issues.push("Set the internal unit cost.");
  if (!product.vendorId) issues.push("Assign a supplier.");
  if (!product.categorySlug) issues.push("Assign a department.");
  if (
    product.category &&
    (product.category.active === false ||
      Boolean(product.category.restricted) !== Boolean(product.restricted))
  )
    issues.push("Match an active department with the same visibility.");
  if (product.stock !== undefined && product.stock <= 0)
    issues.push("Record available stock before publishing.");
  return issues;
}
