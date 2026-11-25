import type { Queryable } from "./db";
import { record } from "./db";
import type { Product } from "@/lib/types";
import { readinessForForm } from "@/lib/product-readiness";

export { readinessForForm };

export type PublishReadiness = {
  ready: boolean;
  issues: string[];
};

export async function publishReadiness(
  db: Queryable,
  product: Product,
): Promise<PublishReadiness> {
  const issues: string[] = [];
  if (!product.images?.length) issues.push("Add at least one product image.");
  if (!product.description?.trim())
    issues.push("Add a customer-facing description.");
  if (!((product.price ?? 0) > 0)) issues.push("Set a price above zero.");
  if (!((product.costPrice ?? 0) >= 0))
    issues.push("Set the internal unit cost.");
  if (!product.vendorId || !(await record(db, "vendors", product.vendorId)))
    issues.push("Assign an active supplier.");
  const category = product.categorySlug
    ? await record<{ active?: boolean; restricted?: boolean }>(
        db,
        "categories",
        product.categorySlug,
      )
    : undefined;
  if (!category) issues.push("Assign an existing department.");
  else {
    if (category.active === false)
      issues.push("Move the product out of an archived department.");
    if (Boolean(category.restricted) !== Boolean(product.restricted))
      issues.push("Match the department's restricted visibility.");
  }
  const stock = await db.query(
    "SELECT COALESCE(sum(available),0)::int AS available FROM inventory WHERE product_id=$1",
    [product.id],
  );
  if (Number(stock.rows[0]?.available ?? 0) <= 0)
    issues.push("Record available stock for at least one variant.");
  return { ready: issues.length === 0, issues };
}
