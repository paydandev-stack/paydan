import "server-only";

function origin(value: string, label: string): string {
  const input = value.trim();
  const url = new URL(input.includes("://") ? input : `https://${input}`);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  )
    throw new Error(`${label} must contain a valid HTTPS origin.`);
  return url.origin;
}

/**
 * Exact browser origins approved for authenticated writes.
 *
 * Vercel-provided values are deployment metadata, not request headers, so they
 * can safely extend the explicit application allowlist without trusting an
 * arbitrary Host or Origin supplied by a client.
 */
export function trustedOrigins(): string[] {
  const values: Array<[string | undefined, string]> = [
    [process.env.BETTER_AUTH_URL, "BETTER_AUTH_URL"],
    ...((process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
      .split(",")
      .map((value, index) => [value || undefined, `BETTER_AUTH_TRUSTED_ORIGINS[${index}]`] as [string | undefined, string])),
    [process.env.VERCEL_PROJECT_PRODUCTION_URL, "VERCEL_PROJECT_PRODUCTION_URL"],
    [process.env.VERCEL_URL, "VERCEL_URL"],
    [process.env.VERCEL_BRANCH_URL, "VERCEL_BRANCH_URL"],
  ];
  return [...new Set(values.filter((entry): entry is [string, string] => Boolean(entry[0]?.trim())).map(([value, label]) => origin(value, label)))];
}

export function isTrustedOrigin(value: string | null): boolean {
  if (!value) return false;
  try {
    return trustedOrigins().includes(new URL(value).origin);
  } catch {
    return false;
  }
}
