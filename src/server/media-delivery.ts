import "server-only";
import { mediaCdnBase } from "@/lib/media-origin";

function cdnBase(): URL | null {
  return mediaCdnBase(process.env.MEDIA_CDN_URL);
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
