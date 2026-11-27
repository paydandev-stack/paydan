import "server-only";

import type { Category, Product } from "@/lib/types";
import { database } from "../db";
import type { Viewer } from "../http";
import { isTestBuyer } from "../test-buyer";

export type DepartmentStockSummary = {
  slug: string;
  name: string;
  productCount: number;
  productIds: string[];
};

function normalizedDepartmentReference(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveDepartment(
  value: string,
  categories: Category[],
): Category | undefined {
  const query = normalizedDepartmentReference(value);
  if (!query) return undefined;
  return categories.find((category) => {
    const references = [
      category.name,
      category.title,
      category.slug,
      ...(category.subcategories ?? []).flatMap((subcategory) => [
        subcategory.name,
        subcategory.slug,
      ]),
    ].map(normalizedDepartmentReference);
    return references.some(
      (reference) => reference === query || query.includes(reference),
    );
  });
}

function markedAvailable(product: Product) {
  return (
    product.availability !== "out_of_stock" &&
    product.variants.some((variant) => variant.availability !== "out_of_stock")
  );
}

/** Confirm available units from inventory, with isolated test data as a fallback. */
export async function confirmedAvailableProducts(
  products: Product[],
  user: Viewer | null,
): Promise<Product[]> {
  if (!products.length) return [];
  if (user && isTestBuyer(user)) return products.filter(markedAvailable);
  try {
    const result = await database().query(
      `SELECT product_id
       FROM inventory
       WHERE product_id=ANY($1::text[])
       GROUP BY product_id
       HAVING SUM(available)>0`,
      [products.map((product) => product.id)],
    );
    const available = new Set(result.rows.map((row) => String(row.product_id)));
    return products.filter((product) => available.has(product.id));
  } catch (error) {
    console.warn("[Ask PAYDAN] Inventory lookup unavailable", {
      code: (error as { code?: string })?.code || "unknown",
    });
    return products.filter(markedAvailable);
  }
}

export async function departmentsWithConfirmedStock(
  products: Product[],
  categories: Category[],
  user: Viewer | null,
): Promise<DepartmentStockSummary[]> {
  const available = await confirmedAvailableProducts(products, user);
  return categories
    .filter((category) => category.active !== false && !category.restricted)
    .sort((left, right) => left.order - right.order)
    .map((category) => {
      const matches = available.filter(
        (product) => product.categorySlug === category.slug,
      );
      return {
        slug: category.slug,
        name: category.name,
        productCount: matches.length,
        productIds: matches.map((product) => product.id),
      };
    })
    .filter((department) => department.productCount > 0);
}
