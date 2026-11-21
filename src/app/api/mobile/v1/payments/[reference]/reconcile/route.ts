import { z } from "zod";
import { verifyPayment } from "@/server/payments";
import {
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/** POST /api/mobile/v1/payments/:reference/reconcile. */
export async function POST(
  request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit("mobile-payment-reconcile:" + user.id, 20);
    const reference = z
      .string()
      .max(150)
      .parse((await context.params).reference);
    return mobileJson(await verifyPayment(reference, user));
  } catch (error) {
    return mobileFailure(error);
  }
}
