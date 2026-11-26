import { z } from "zod";
import {
  body,
  failure,
  json,
  requireCapability,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
import { adminReviews, moderateReview } from "@/server/reviews";

export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    requireCapability(user, "reviews.read");
    const raw = new URL(request.url).searchParams.get("status") || undefined;
    const status = z
      .enum(["pending", "published", "rejected"])
      .optional()
      .parse(raw);
    return json({ reviews: await adminReviews(status) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    requireCapability(user, "reviews.moderate");
    return json(await moderateReview(user, await body(request)));
  } catch (error) {
    return failure(error);
  }
}
