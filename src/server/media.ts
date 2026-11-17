import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { database, records } from "./db";
import {
  HttpError,
  requireAnyCapability,
  requireCapability,
  type Viewer,
} from "./http";
import { catalogCdnUrl } from "./media-delivery";
import { signedCloudFrontUrl } from "./cloudfront";
import { isTestBuyer } from "./test-buyer";
import { writeAudit } from "./audit";
import type { Banner, Product } from "@/lib/types";
type Media = {
  id: string;
  owner_id: string;
  object_key: string;
  purpose: string;
  mime: string;
  size: number;
  status: string;
};
function s3Client(endpoint?: string) {
  if (!process.env.AWS_REGION || !process.env.S3_BUCKET)
    throw new HttpError(503, "Image storage is not configured yet.");
  return new S3Client({
    region: process.env.AWS_REGION,
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}
function config() {
  if (!process.env.S3_BUCKET)
    throw new HttpError(503, "Image storage is not configured yet.");
  return {
    client: s3Client(process.env.S3_ENDPOINT),
    // Browser uploads need a presigned URL reachable from the user's machine.
    publicClient: s3Client(
      process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT,
    ),
    bucket: process.env.S3_BUCKET,
  };
}
export async function beginUpload(user: Viewer, input: unknown) {
  const value = z
    .object({
      purpose: z.enum(["catalog", "sourcing", "return"]),
      mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      size: z.number().int().min(1).max(5242880),
    })
    .parse(input);
  if (value.purpose === "catalog") requireCapability(user, "catalog.write");
  const { publicClient, bucket } = config();
  const id = randomUUID();
  const key = `${isTestBuyer(user) ? "test/" : ""}incoming/${user.id}/${id}`;
  const post = await createPresignedPost(publicClient, {
    Bucket: bucket,
    Key: key,
    Expires: 120,
    Fields: { "Content-Type": value.mime },
    Conditions: [
      ["content-length-range", value.size, value.size],
      ["eq", "$Content-Type", value.mime],
    ],
  });
  await database().query(
    "INSERT INTO media(id,owner_id,object_key,purpose,mime,size) VALUES($1,$2,$3,$4,$5,$6)",
    [id, user.id, key, value.purpose, value.mime, value.size],
  );
  return { id, ...post };
}
export async function finalizeUpload(user: Viewer, id: string) {
  const result = await database().query(
    "SELECT * FROM media WHERE id=$1 AND owner_id=$2",
    [id, user.id],
  );
  const media: Media = result.rows[0];
  if (!media) throw new HttpError(404, "Upload not found.");
  if (media.purpose === "catalog") requireCapability(user, "catalog.write");
  if (media.status === "ready")
    return {
      url:
        (media.purpose === "catalog" && catalogCdnUrl(media.object_key)) ||
        `/api/media/${id}`,
    };
  const { client, bucket } = config();
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: media.object_key }),
  );
  if (object.ContentLength !== media.size || object.ContentType !== media.mime)
    throw new HttpError(
      400,
      "Uploaded file does not match the selected image.",
    );
  const bytes = await object.Body!.transformToByteArray();
  if (bytes.length !== media.size)
    throw new HttpError(400, "Invalid upload size.");
  let image: Buffer;
  try {
    image = await sharp(bytes, { limitInputPixels: 24000000, animated: false })
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new HttpError(400, "The file is not a supported image.");
  }
  const finalKey = `${isTestBuyer(user) ? "test/" : ""}${media.purpose}/${randomUUID()}.webp`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      Body: image,
      ContentType: "image/webp",
      CacheControl:
        media.purpose === "catalog"
          ? "public, max-age=31536000, immutable"
          : "private, no-store",
      ContentDisposition: "inline",
      // AWS S3 supports SSE-S3 directly. Local MinIO is already isolated and
      // may not have a KMS configured, so do not request SSE through its endpoint.
      ...(process.env.S3_ENDPOINT
        ? {}
        : { ServerSideEncryption: "AES256" as const }),
    }),
  );
  await database().query(
    "UPDATE media SET status='ready',object_key=$2,mime='image/webp',size=$3 WHERE id=$1",
    [id, finalKey, image.length],
  );
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: media.object_key }),
  );
  if (media.purpose === "catalog")
    await writeAudit(database(), {
      actor: user.email,
      action: "media.finalized",
      record: id,
      capability: "catalog.write",
      source: "admin",
      after: { mime: "image/webp", size: image.length },
    });
  return {
    url:
      (media.purpose === "catalog" && catalogCdnUrl(finalKey)) ||
      `/api/media/${id}`,
  };
}
export async function readMedia(id: string, user: Viewer | null) {
  const result = await database().query(
    "SELECT * FROM media WHERE id=$1 AND status='ready'",
    [id],
  );
  const media: Media = result.rows[0];
  if (!media) throw new HttpError(404, "Image not found.");
  if (media.purpose !== "catalog" && user?.id !== media.owner_id)
    requireAnyCapability(user, [
      "sourcing.read",
      "returns.read",
      "support.read",
    ]);
  const cdnUrl =
    media.purpose === "catalog" ? catalogCdnUrl(media.object_key) : null;
  if (cdnUrl)
    return {
      url: cdnUrl,
      cacheControl:
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    };
  if (!process.env.S3_ENDPOINT)
    return {
      url: signedCloudFrontUrl(media.object_key),
      cacheControl: "private, no-store",
    };
  const { publicClient, bucket } = config();
  const url = await getSignedUrl(
    publicClient,
    new GetObjectCommand({
      Bucket: bucket,
      Key: media.object_key,
      ResponseContentType: "image/webp",
      ResponseContentDisposition: "inline",
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: 60 },
  );
  return { url, cacheControl: "private, no-store" };
}

export async function cleanupOrphanedCatalogMedia(limit = 50) {
  const bounded = Math.max(1, Math.min(limit, 100));
  const [candidates, products, banners] = await Promise.all([
    database().query(
      `SELECT id,object_key
       FROM media
       WHERE purpose='catalog' AND status='ready'
         AND object_key LIKE 'catalog/%'
         AND created_at < now() - interval '24 hours'
       ORDER BY created_at LIMIT $1`,
      [bounded],
    ),
    records<Product>(database(), "products"),
    records<Banner>(database(), "banners"),
  ]);
  const references = new Set([
    ...products.flatMap((product) => product.images),
    ...banners.map((banner) => banner.image),
  ]);
  const { client, bucket } = config();
  let deleted = 0;
  let failed = 0;
  for (const candidate of candidates.rows) {
    const delivered = catalogCdnUrl(candidate.object_key);
    if (
      references.has(`/api/media/${candidate.id}`) ||
      (delivered && references.has(delivered))
    )
      continue;
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: candidate.object_key,
        }),
      );
      await database().query("DELETE FROM media WHERE id=$1", [candidate.id]);
      await writeAudit(database(), {
        actor: "system",
        action: "media.orphan-deleted",
        record: candidate.id,
        source: "worker",
        after: { objectKey: candidate.object_key },
      });
      deleted += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: candidates.rows.length, deleted, failed };
}
