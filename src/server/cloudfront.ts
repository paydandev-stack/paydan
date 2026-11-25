import "server-only";

import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { HttpError } from "./http";
import { mediaCdnBase } from "@/lib/media-origin";

function privateKey(): string {
  const encoded = process.env.CLOUDFRONT_PRIVATE_KEY_BASE64?.trim();
  if (!encoded)
    throw new HttpError(503, "Private media delivery is not configured yet.");
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    throw new HttpError(503, "Private media delivery is misconfigured.");
  }
  if (
    !decoded.includes("-----BEGIN") ||
    !decoded.includes("PRIVATE KEY-----") ||
    !decoded.includes("-----END")
  )
    throw new HttpError(503, "Private media delivery is misconfigured.");
  return decoded;
}

function ttlSeconds(): number {
  const value = Number(process.env.CLOUDFRONT_SIGNED_URL_TTL_SECONDS || 300);
  if (!Number.isInteger(value) || value < 30 || value > 900)
    throw new HttpError(503, "Private media URL lifetime is misconfigured.");
  return value;
}

export function cloudFrontObjectUrl(objectKey: string): string {
  let root: URL | null;
  try {
    root = mediaCdnBase(process.env.MEDIA_CDN_URL);
  } catch {
    throw new HttpError(503, "Private media delivery is misconfigured.");
  }
  if (!root)
    throw new HttpError(503, "Private media delivery is not configured yet.");
  const encodedKey = objectKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return new URL(encodedKey, root).toString();
}

export function signedCloudFrontUrl(objectKey: string): string {
  if (!/^(sourcing|return)\//.test(objectKey))
    throw new HttpError(400, "This object is not private media.");
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID?.trim();
  if (!keyPairId)
    throw new HttpError(503, "Private media delivery is not configured yet.");
  return getSignedUrl({
    url: cloudFrontObjectUrl(objectKey),
    keyPairId,
    privateKey: privateKey(),
    dateLessThan: new Date(Date.now() + ttlSeconds() * 1000).toISOString(),
  });
}
