import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.BETTER_AUTH_URL || "https://www.paydan.store";
  const enabled = process.env.SITE_INDEXING_ENABLED === "true";
  return {
    rules: enabled
      ? {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/admin/",
            "/account/",
            "/dashboard",
            "/api/",
            "/checkout/",
          ],
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${site.replace(/\/$/, "")}/sitemap.xml`,
    host: site,
  };
}
