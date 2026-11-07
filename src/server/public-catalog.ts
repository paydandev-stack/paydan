import "server-only";
import { unstable_cache } from "next/cache";
import { snapshot } from "./snapshot";

export const PUBLIC_CATALOG_CACHE_TAG = "public-catalog";

const cachedPublicCatalog = unstable_cache(
  () => snapshot(null),
  [PUBLIC_CATALOG_CACHE_TAG],
  {
    revalidate: 300,
    tags: [PUBLIC_CATALOG_CACHE_TAG],
  },
);

/**
 * Price-free, identity-free catalogue state. This is the only store payload
 * permitted in a shared cache; member pricing and account data use /api/store.
 */
export function publicCatalogSnapshot() {
  return cachedPublicCatalog();
}
