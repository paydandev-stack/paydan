import "server-only";

function origin(value: string, label: string): string {
const input = value.trim();
if (/^[a-z][a-z0-9+.-]*:\/\/[^/]*$/i.test(input) && !input.toLowerCase().startsWith('http')) {
const schemeUrl = new URL(input);
if (schemeUrl.username || schemeUrl.password) throw new Error(label + " must not contain credentials.");
return schemeUrl.protocol + "//" + schemeUrl.host;
}
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
/**
 * Native app schemes (e.g. paydan://, https://paydan.store applinks)
 * approved for mobile OAuth callbacks and payment return links.
 * Set via MOBILE_APP_SCHEMES="paydan://,https://paydan.store".
 * Never disable origin validation globally - only these explicit values.
 */
export function mobileSchemes(): string[] {
return (process.env.MOBILE_APP_SCHEMES || "")
.split(",")
.map((value) => value.trim())
.filter(Boolean);
}

/**
 * Returns true when a deep-link return URL is allowlisted for payment or
 * OAuth redirects. Exact-prefix match against configured mobile schemes
 * plus the standard trusted origins.
 */
export function isMobileReturnUrl(value: string | undefined): boolean {
if (!value) return false;
try {
const candidate = new URL(value);
if (candidate.username || candidate.password) return false;
const prefixes = [...trustedOrigins(), ...mobileSchemes()];
return prefixes.some((prefix) => value.startsWith(prefix));
} catch {
return false;
}
}

export function trustedOrigins(): string[] {
const values: Array<[string | undefined, string]> = [
[process.env.BETTER_AUTH_URL, "BETTER_AUTH_URL"],
...(process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
.split(",")
.map(
(value, index) =>
[value || undefined, `BETTER_AUTH_TRUSTED_ORIGINS[${index}]`] as [
string | undefined,
string,
],
),
...mobileSchemes().map((value) => [value, "MOBILE_APP_SCHEMES"] as [string, string]),
[
process.env.VERCEL_PROJECT_PRODUCTION_URL,
"VERCEL_PROJECT_PRODUCTION_URL",
],
[process.env.VERCEL_URL, "VERCEL_URL"],
[process.env.VERCEL_BRANCH_URL, "VERCEL_BRANCH_URL"],
];
return [
...new Set(
values
.filter((entry): entry is [string, string] => Boolean(entry[0]?.trim()))
.map(([value, label]) => origin(value, label)),
),
];
}

export function isTrustedOrigin(value: string | null): boolean {
if (!value) return false;
try {
return trustedOrigins().includes(new URL(value).origin);
} catch {
return false;
}
}
