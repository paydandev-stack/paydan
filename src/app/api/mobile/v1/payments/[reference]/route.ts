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

/**
 * GET /api/mobile/v1/payments/:reference
 * Server-authoritative payment status. The app treats checkout as pending
 * until this endpoint (or an authenticated webhook) confirms it.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-payment:${user.id}`, 30);
    const reference = z
      .string()
      .max(150)
      .parse((await context.params).reference);
    return mobileJson(await verifyPayment(reference, user));
  } catch (error) {
    return mobileFailure(error);
  }
}
