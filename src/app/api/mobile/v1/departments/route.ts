import { departmentSchema } from "@/mobile-contract/schemas";
import { database, records } from "@/server/db";
import type { Category } from "@/lib/types";
import { isCustomerVisibleCategory } from "@/lib/catalog-visibility";
import {
  mobileFailure,
  mobilePublicJson,
  mobileViewer,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/**
 * GET /api/mobile/v1/departments
 * Full customer-visible department list. Public cacheable; no prices.
 */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    let categories: Category[];
    if (!process.env.DATABASE_URL) {
      const { categories: seed } = await import("@/data/categories");
      categories = seed;
    } else {
      categories = await records<Category>(database(), "categories");
    }
    const visible = categories
      .filter(isCustomerVisibleCategory)
      .sort((a, b) => a.order - b.order)
      .map((category) =>
        departmentSchema.parse({
          ...category,
          subcategories: category.subcategories ?? [],
          facets: category.facets ?? [],
        }),
      );
    return mobilePublicJson(
      { departments: visible },
      200,
      user ? { "Cache-Control": "private, no-store" } : undefined,
    );
  } catch (error) {
    return mobileFailure(error);
  }
}
