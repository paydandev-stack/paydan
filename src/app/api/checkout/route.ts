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
import { checkout } from "@/server/schemas";
import {
  initialize,
  quoteCart,
  resumePayment,
  verifyPayment,
} from "@/server/payments";
import { database } from "@/server/db";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    await limit(`checkout:${user.id}`, 20);
    const value = await body(request);
    if (value.action === "verify")
      return json(
        await verifyPayment(z.string().max(150).parse(value.reference), user),
      );
    if (value.action === "resume")
      return json(
        await resumePayment(user, z.string().max(150).parse(value.orderId)),
      );
    const input = checkout.parse(value.input);
    if (value.action === "quote") {
      const q = await quoteCart(database(), user, input);
      return json({
        subtotal: q.subtotal,
        deliveryFee: q.deliveryFee,
        discount: q.discount,
        total: q.total,
        eta: q.eta,
      });
    }
    return json(
      await initialize(user, input, z.string().uuid().parse(value.key)),
    );
  } catch (error) {
    return failure(error);
  }
}
