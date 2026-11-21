import "server-only";

import { z } from "zod";
import { toMemberProduct, toPublicProduct } from "@/lib/catalog-dto";
import type { Product } from "@/lib/types";
import { database } from "./db";
import { HttpError, type Viewer } from "./http";
import {
  catalogQuerySchema,
  type MobileCatalogQuery,
} from "@/mobile-contract/schemas";

const cursorSchema = z.object({
  offset: z.number().int().min(0),
  asOf: z.string().datetime(),
});

function cursorState(cursor: string | undefined) {
  if (!cursor) return { offset: 0, asOf: new Date().toISOString() };
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return cursorSchema.parse(parsed);
  } catch {
    throw new HttpError(400, "Invalid catalogue cursor.");
  }
}

const nextCursor = (offset: number, asOf: string) =>
  Buffer.from(JSON.stringify({ offset, asOf })).toString("base64url");

const csv = (value: string | undefined) =>
  value
    ? [
        ...new Set(
          value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];

/**
 * Shared catalogue query used by web (/api/products) and mobile
 * (/api/mobile/v1/catalog). Viewer-scoped price projection; guests never
 * receive monetary fields and cannot sort/filter by price.
 */
export async function queryCatalog(
  user: Viewer | null,
  raw: unknown,
): Promise<{
  products: ReturnType<typeof toPublicProduct>[];
  total: number;
  nextCursor: string | null;
}> {
  const input: MobileCatalogQuery = catalogQuerySchema.parse(raw);
  if (!user && (input.sort.startsWith("price") || csv(input.priceBands).length))
    throw new HttpError(403, "Sign in to use priced search and sorting.");

  const brands = csv(input.brands).map((value) => value.toLowerCase());
  const availability = csv(input.availability);
  const priceBands = user ? csv(input.priceBands) : [];
  const cursor = cursorState(input.cursor);
  const orderBy =
    input.sort === "name"
      ? "lower(p.data->>'name') ASC,p.id ASC"
      : input.sort === "price-asc"
        ? "(p.data->>'price')::numeric ASC,p.id ASC"
        : input.sort === "price-desc"
          ? "(p.data->>'price')::numeric DESC,p.id ASC"
          : input.sort === "newest"
            ? "p.updated_at DESC,p.id ASC"
            : "COALESCE((p.data->>'featured')::boolean,false) DESC, COALESCE((p.data->>'rating')::numeric,0) DESC, lower(p.data->>'name') ASC, p.id ASC";

  const filters = `
p.kind='products'
AND p.data->>'status'='published'
AND NOT COALESCE((p.data->>'restricted')::boolean,false)
AND COALESCE((c.data->>'active')::boolean,true)
AND NOT COALESCE((c.data->>'restricted')::boolean,false)
AND ($1::text IS NULL OR p.data->>'categorySlug'=$1)
AND (cardinality($2::text[])=0 OR lower(p.data->>'brand')=ANY($2::text[]))
AND (cardinality($3::text[])=0 OR p.data->>'availability'=ANY($3::text[]))
AND ($4::text IS NULL OR concat_ws(' ',p.data->>'name',p.data->>'brand',p.data->>'description',c.data->>'name') ILIKE '%' || $4 || '%')
AND (
cardinality($5::text[])=0
OR ('under-25k'=ANY($5::text[]) AND (p.data->>'price')::numeric < 25000)
OR ('25k-100k'=ANY($5::text[]) AND (p.data->>'price')::numeric >= 25000 AND (p.data->>'price')::numeric < 100000)
OR ('100k-500k'=ANY($5::text[]) AND (p.data->>'price')::numeric >= 100000 AND (p.data->>'price')::numeric < 500000)
OR ('over-500k'=ANY($5::text[]) AND (p.data->>'price')::numeric >= 500000)
)
AND (
$6='all'
OR ($6='featured' AND COALESCE((p.data->>'featured')::boolean,false))
OR ($6='new-arrivals' AND COALESCE((p.data->>'newArrival')::boolean,false))
OR ($6='deals' AND (
CASE WHEN $7::boolean
THEN (p.data->>'compareAt') IS NOT NULL AND (p.data->>'compareAt')::numeric > (p.data->>'price')::numeric
ELSE COALESCE((p.data->>'featured')::boolean,false)
END
))
)
AND p.updated_at <= $8::timestamptz`;
  const parameters = [
    input.department ?? null,
    brands,
    availability,
    input.q ?? null,
    priceBands,
    input.collection,
    Boolean(user),
  ];
  const result = await database().query(
    `SELECT p.data, count(*) OVER()::int AS total
FROM commerce_record p
JOIN commerce_record c
ON c.kind='categories' AND c.id=p.data->>'categorySlug'
WHERE ${filters}
ORDER BY ${orderBy}
OFFSET $9 LIMIT $10`,
    [...parameters, cursor.asOf, cursor.offset, input.limit + 1],
  );
  const hasMore = result.rows.length > input.limit;
  const rows = result.rows.slice(0, input.limit);
  const products = rows.map((row) =>
    user
      ? toMemberProduct(row.data as Product)
      : toPublicProduct(row.data as Product),
  );
  return {
    products,
    total: Number(rows[0]?.total ?? 0),
    nextCursor: hasMore ? nextCursor(cursor.offset + input.limit, cursor.asOf) : null,
  };
}

/** Single product detail + related, viewer-scoped. */
export async function productDetail(user: Viewer | null, slug: string) {
  const clean = z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(200)
    .parse(slug);
  const result = await database().query(
    `SELECT p.data
FROM commerce_record p
JOIN commerce_record c
ON c.kind='categories' AND c.id=p.data->>'categorySlug'
WHERE p.kind='products'
AND p.data->>'slug'=$1
AND p.data->>'status'='published'
AND NOT COALESCE((p.data->>'restricted')::boolean,false)
AND COALESCE((c.data->>'active')::boolean,true)
AND NOT COALESCE((c.data->>'restricted')::boolean,false)
LIMIT 1`,
    [clean],
  );
  const product = result.rows[0]?.data as Product | undefined;
  if (!product) throw new HttpError(404, "Product not found.");
  const relatedResult = await database().query(
    `SELECT p.data
FROM commerce_record p
JOIN commerce_record c
ON c.kind='categories' AND c.id=p.data->>'categorySlug'
WHERE p.kind='products'
AND p.id<>$1
AND p.data->>'categorySlug'=$2
AND p.data->>'status'='published'
AND NOT COALESCE((p.data->>'restricted')::boolean,false)
AND COALESCE((c.data->>'active')::boolean,true)
AND NOT COALESCE((c.data->>'restricted')::boolean,false)
ORDER BY COALESCE((p.data->>'featured')::boolean,false) DESC,
p.updated_at DESC
LIMIT 5`,
    [product.id, product.categorySlug],
  );
  const project = (value: Product) =>
    user ? toMemberProduct(value) : toPublicProduct(value);
  return {
    product: project(product),
    related: relatedResult.rows.map((row) => project(row.data as Product)),
  };
}
