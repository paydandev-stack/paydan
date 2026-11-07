import "server-only";

function cdnBase(): URL | null {
  const value = process.env.MEDIA_CDN_URL?.trim();
  if (!value) return null;

  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "MEDIA_CDN_URL must be a public HTTPS origin without credentials, a query, or a fragment.",
    );
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}

export function catalogCdnUrl(objectKey: string): string | null {
  if (!objectKey.startsWith("catalog/")) return null;
  const base = cdnBase();
  if (!base) return null;
  const encodedKey = objectKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return new URL(encodedKey, base).toString();
}

export function isCatalogCdnUrl(value: string): boolean {
  const base = cdnBase();
  if (!base) return false;
  try {
    const candidate = new URL(value);
    const catalogPath = `${base.pathname}catalog/`;
    return (
      candidate.protocol === "https:" &&
      candidate.origin === base.origin &&
      candidate.pathname.startsWith(catalogPath) &&
      !candidate.username &&
      !candidate.password &&
      !candidate.search &&
      !candidate.hash
    );
  } catch {
    return false;
  }
}
