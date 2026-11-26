import { z } from "zod";
import {
  body,
  failure,
  json,
  limit,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
import { reviewsForProduct, submitProductReview } from "@/server/reviews";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = z
      .string()
      .trim()
      .min(1)
      .max(160)
      .parse(url.searchParams.get("productId"));
    const sort = z
      .enum(["newest", "highest", "lowest"])
      .catch("newest")
      .parse(url.searchParams.get("sort"));
    const cursor = z
      .string()
      .max(100)
      .optional()
      .parse(url.searchParams.get("cursor") || undefined);
    const user = await viewer(request.headers);
    await limit(
      `reviews:read:${request.headers.get("x-forwarded-for") || "local"}`,
      120,
      60,
    );
    return json(await reviewsForProduct(productId, user, { sort, cursor }));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    await limit(`reviews:write:${user.id}`, 10, 300);
    return json(await submitProductReview(user, await body(request)), 201);
  } catch (error) {
    return failure(error);
  }
}
