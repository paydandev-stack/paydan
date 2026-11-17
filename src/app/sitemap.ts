import type { MetadataRoute } from "next";
import { publicCatalogSnapshot } from "@/server/public-catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (
    process.env.BETTER_AUTH_URL || "https://www.paydan.store"
  ).replace(/\/$/, "");
  const state = await publicCatalogSnapshot();
  const staticRoutes = [
    "",
    "/about",
    "/shop",
    "/categories",
    "/new-arrivals",
    "/deals",
    "/help",
    "/faq",
    "/contact",
    "/policies/shipping",
    "/policies/returns",
    "/policies/privacy",
    "/policies/terms",
  ];
  return [
    ...staticRoutes.map((route) => ({
      url: `${site}${route}`,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.7,
    })),
    ...state.categories.map((category) => ({
      url: `${site}/category/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...state.products.map((product) => ({
      url: `${site}/product/${product.slug}`,
      lastModified: product.updatedAt || undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
