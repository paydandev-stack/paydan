import { z } from "zod";
import { customerOrder } from "@/server/snapshot";
import { database, record } from "@/server/db";
import { HttpError } from "@/server/http";
import { scopedRecordKind } from "@/server/test-buyer";
import type { Order } from "@/lib/types";
import {
  mobileFailure,
  mobileJson,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/** GET /api/mobile/v1/orders/:id — viewer-scoped order detail/tracking. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    const id = z.string().min(1).max(150).parse((await context.params).id);
    const order = await record<Order>(
      database(),
      scopedRecordKind(user, "orders"),
      id,
    );
    if (!order || order.customerId !== user.id)
      throw new HttpError(404, "Order not found.");
    return mobileJson({ order: customerOrder(order) });
  } catch (error) {
    return mobileFailure(error);
  }
}
