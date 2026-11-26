import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Order, ProductReview, ProductReviewStatus } from "@/lib/types";
import { normalizedOrderItems } from "@/lib/order-lines";
import { database, put, records } from "./db";
import { HttpError, type Viewer } from "./http";
import { scopedRecordKind } from "./test-buyer";

export const reviewSubmission = z.object({
  productId: z.string().trim().min(1).max(160),
  orderId: z.string().trim().min(1).max(160),
  orderLineId: z.string().trim().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(10).max(2000),
});

const reviewEdit = reviewSubmission.pick({
  rating: true,
  title: true,
  body: true,
});

function publicReview(row: Record<string, unknown>): ProductReview {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    productName: row.product_name ? String(row.product_name) : undefined,
    reviewerName: String(row.reviewer_name),
    rating: Number(row.rating),
    title: String(row.title),
    body: String(row.body),
    status: String(row.status) as ProductReviewStatus,
    verifiedPurchase: Boolean(row.verified_purchase),
    adminResponse: row.admin_response ? String(row.admin_response) : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

async function reviewEligibility(user: Viewer, productId: string) {
  const orders = await records<Order>(
    database(),
    scopedRecordKind(user, "orders"),
    user.id,
  );
  const existing = await database().query(
    "SELECT order_line_id FROM product_review WHERE owner_id=$1 AND product_id=$2",
    [user.id, productId],
  );
  const reviewed = new Set(
    existing.rows.map((row) => String(row.order_line_id)),
  );
  return orders.flatMap((order) => {
    if (
      order.paymentStatus !== "paid" ||
      order.fulfillmentStatus !== "delivered"
    )
      return [];
    return normalizedOrderItems(order)
      .filter(
        (item) =>
          item.productId === productId &&
          item.lineId &&
          !reviewed.has(item.lineId),
      )
      .map((item) => ({
        orderId: order.id,
        orderLineId: item.lineId!,
        productName: item.name,
        variantLabel: item.variantLabel,
        deliveredAt:
          [...order.timeline].reverse().find((event) => event.done)?.at ||
          order.placedAt,
      }));
  });
}

export async function reviewsForProduct(
  productId: string,
  user: Viewer | null,
  options: { sort?: string; cursor?: string; limit?: number } = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 10, 25));
  const cursorParts = options.cursor?.split("|");
  const cursorAt = cursorParts?.[0];
  const cursorRating = cursorParts?.[1] ? Number(cursorParts[1]) : undefined;
  if (
    options.cursor &&
    (!cursorAt ||
      Number.isNaN(Date.parse(cursorAt)) ||
      !Number.isInteger(cursorRating) ||
      cursorRating! < 1 ||
      cursorRating! > 5)
  )
    throw new HttpError(400, "Invalid review cursor.");
  const orderBy =
    options.sort === "highest"
      ? "rating DESC, created_at DESC"
      : options.sort === "lowest"
        ? "rating ASC, created_at DESC"
        : "created_at DESC";
  const cursorPredicate =
    options.sort === "highest"
      ? "($2::timestamptz IS NULL OR rating < $3 OR (rating = $3 AND created_at < $2))"
      : options.sort === "lowest"
        ? "($2::timestamptz IS NULL OR rating > $3 OR (rating = $3 AND created_at < $2))"
        : "($2::timestamptz IS NULL OR created_at < $2)";
  const ratingSort = options.sort === "highest" || options.sort === "lowest";
  const result = await database().query(
    `SELECT * FROM product_review
     WHERE product_id=$1 AND status='published' AND ${cursorPredicate}
     ORDER BY ${orderBy} LIMIT $${ratingSort ? 4 : 3}`,
    ratingSort
      ? [productId, cursorAt ?? null, cursorRating ?? null, limit + 1]
      : [productId, cursorAt ?? null, limit + 1],
  );
  const rows = result.rows.slice(0, limit);
  const aggregate = await database().query(
    `SELECT COUNT(*)::int AS count, COALESCE(AVG(rating),0)::float AS average,
      COUNT(*) FILTER (WHERE rating=1)::int AS one,
      COUNT(*) FILTER (WHERE rating=2)::int AS two,
      COUNT(*) FILTER (WHERE rating=3)::int AS three,
      COUNT(*) FILTER (WHERE rating=4)::int AS four,
      COUNT(*) FILTER (WHERE rating=5)::int AS five
     FROM product_review WHERE product_id=$1 AND status='published'`,
    [productId],
  );
  const summary = aggregate.rows[0];
  const ownReviews = user
    ? await database().query(
        `SELECT * FROM product_review
         WHERE product_id=$1 AND owner_id=$2 ORDER BY created_at DESC`,
        [productId, user.id],
      )
    : null;
  return {
    reviews: rows.map(publicReview),
    summary: {
      count: Number(summary.count),
      average: Number(summary.average),
      distribution: {
        1: Number(summary.one),
        2: Number(summary.two),
        3: Number(summary.three),
        4: Number(summary.four),
        5: Number(summary.five),
      },
    },
    eligibility: user ? await reviewEligibility(user, productId) : [],
    ownReviews: ownReviews ? ownReviews.rows.map(publicReview) : [],
    nextCursor:
      result.rows.length > limit
        ? `${new Date(String(rows.at(-1)?.created_at)).toISOString()}|${Number(rows.at(-1)?.rating)}`
        : null,
  };
}

export async function submitProductReview(user: Viewer, raw: unknown) {
  const input = reviewSubmission.parse(raw);
  const eligible = await reviewEligibility(user, input.productId);
  if (
    !eligible.some(
      (line) =>
        line.orderId === input.orderId &&
        line.orderLineId === input.orderLineId,
    )
  )
    throw new HttpError(403, "Only a delivered purchase can be reviewed.");
  const id = randomUUID();
  try {
    const result = await database().query(
      `INSERT INTO product_review(
        id,product_id,owner_id,reviewer_name,order_id,order_line_id,rating,title,body
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        id,
        input.productId,
        user.id,
        user.name,
        input.orderId,
        input.orderLineId,
        input.rating,
        input.title,
        input.body,
      ],
    );
    return publicReview(result.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new HttpError(
        409,
        "You have already reviewed this purchased item.",
      );
    throw error;
  }
}

async function refreshProductRating(productId: string) {
  const aggregate = await database().query(
    "SELECT COUNT(*)::int AS count, COALESCE(AVG(rating),0)::float AS average FROM product_review WHERE product_id=$1 AND status='published'",
    [productId],
  );
  const { count, average } = aggregate.rows[0];
  await database().query(
    `UPDATE commerce_record SET data=
      jsonb_set(
        jsonb_set(data,'{rating}',to_jsonb($2::numeric),true),
        '{reviewCount}',to_jsonb($3::int),true
      ), updated_at=now()
     WHERE kind IN ('products','testProducts') AND id=$1`,
    [productId, Number(Number(average).toFixed(1)), Number(count)],
  );
}

export async function editOwnReview(
  user: Viewer,
  reviewId: string,
  raw: unknown,
) {
  const input = reviewEdit.parse(raw);
  const result = await database().query(
    `UPDATE product_review SET rating=$3,title=$4,body=$5,status='pending',
      moderated_at=NULL,moderated_by=NULL,updated_at=now()
     WHERE id=$1 AND owner_id=$2 RETURNING *`,
    [reviewId, user.id, input.rating, input.title, input.body],
  );
  if (!result.rows.length) throw new HttpError(404, "Review not found.");
  await refreshProductRating(String(result.rows[0].product_id));
  return publicReview(result.rows[0]);
}

export async function deleteOwnReview(user: Viewer, reviewId: string) {
  const result = await database().query(
    "DELETE FROM product_review WHERE id=$1 AND owner_id=$2 RETURNING product_id",
    [reviewId, user.id],
  );
  if (!result.rows.length) throw new HttpError(404, "Review not found.");
  await refreshProductRating(String(result.rows[0].product_id));
  return { deleted: true };
}

export async function adminReviews(status?: ProductReviewStatus) {
  const result = await database().query(
    `SELECT review.*,
      COALESCE(product.data->>'name', test_product.data->>'name') AS product_name
     FROM product_review review
     LEFT JOIN commerce_record product
       ON product.kind='products' AND product.id=review.product_id
     LEFT JOIN commerce_record test_product
       ON test_product.kind='testProducts' AND test_product.id=review.product_id
       AND test_product.owner_id=review.owner_id
     WHERE ($1::text IS NULL OR review.status=$1)
     ORDER BY review.created_at DESC LIMIT 100`,
    [status ?? null],
  );
  return result.rows.map(publicReview);
}

export async function moderateReview(user: Viewer, raw: unknown) {
  const input = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["published", "rejected"]),
      adminResponse: z.string().trim().max(1000).optional(),
    })
    .parse(raw);
  const result = await database().query(
    `UPDATE product_review SET status=$2,admin_response=$3,moderated_at=now(),
      moderated_by=$4,updated_at=now() WHERE id=$1 RETURNING *`,
    [input.id, input.status, input.adminResponse || null, user.id],
  );
  if (!result.rows.length) throw new HttpError(404, "Review not found.");
  const review = publicReview(result.rows[0]);
  await refreshProductRating(review.productId);
  const auditId = randomUUID();
  await put(database(), "audit", auditId, {
    id: auditId,
    actor: user.email,
    action: `Review ${input.status}`,
    record: review.id,
    at: new Date().toISOString(),
    capability: "reviews.moderate",
    source: "admin",
    after: { status: input.status },
  });
  return review;
}
