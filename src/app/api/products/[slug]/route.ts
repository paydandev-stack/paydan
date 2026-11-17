import { z } from "zod";
import { toMemberProduct, toPublicProduct } from "@/lib/catalog-dto";
import type { Product } from "@/lib/types";
import { database } from "@/server/db";
import { failure, HttpError, json, viewer } from "@/server/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await viewer(request.headers);
    const slug = z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(200)
      .parse((await context.params).slug);
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
      [slug],
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
    return json(
      {
        product: project(product),
        related: relatedResult.rows.map((row) => project(row.data as Product)),
      },
      200,
      user
        ? undefined
        : {
            "Cache-Control":
              "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
            Vary: "Accept-Encoding",
          },
    );
  } catch (error) {
    return failure(error);
  }
}
