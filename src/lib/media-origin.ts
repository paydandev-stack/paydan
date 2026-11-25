/** Parse the configured public media host, accepting a bare CDN hostname. */
export function mediaCdnBase(value: string | undefined): URL | null {
  const raw = value?.trim();
  if (!raw) return null;

  const candidate = raw.includes("://") ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "MEDIA_CDN_URL must be a public HTTPS host without credentials, a query, or a fragment.",
    );
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}
