import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Order, Vendor } from "@/lib/types";
import { put, record, transaction } from "@/server/db";
import {
  body,
  failure,
  HttpError,
  json,
  requireRole,
  sameOrigin,
  viewer,
} from "@/server/http";
import { amount } from "@/server/schemas";
import { enqueueMail } from "@/server/mail/queue";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireRole(user, ["Procurement Manager"]);
    const input = z
      .object({
        orderId: z.string().uuid(),
        vendorId: z.string().max(150),
        costs: z
          .array(
            z.object({ productId: z.string().max(200), costPrice: amount }),
          )
          .min(1),
        confirmed: z.literal(true),
      })
      .parse(await body(request));
    await transaction(async (db) => {
      const order = await record<Order>(db, "orders", input.orderId, true);
      const vendor = await record<Vendor>(db, "vendors", input.vendorId);
      if (
        !order ||
        order.paymentStatus !== "pending" ||
        !order.notes.startsWith("Sourcing request")
      )
        throw new HttpError(409, "Select an unpaid sourced order.");
      if (!vendor || vendor.status !== "active")
        throw new HttpError(400, "Choose an active supplier.");
      const payment = await db.query(
        "SELECT reference FROM payment WHERE order_id=$1",
        [order.id],
      );
      if (payment.rows.length)
        throw new HttpError(
          409,
          "Payment has started; this confirmation cannot change.",
        );
      for (const item of order.items) {
        const cost = input.costs.find((c) => c.productId === item.productId);
        if (!cost)
          throw new HttpError(
            400,
            "Provide the confirmed supplier cost for each item.",
          );
        item.costPrice = cost.costPrice;
        item.vendorId = vendor.id;
      }
      order.vendorGroups = [
        {
          id: randomUUID(),
          vendorId: vendor.id,
          items: order.items,
          stage: "awaiting_assignment",
          assignee: user!.name,
          eta: "",
          urgent: false,
          notes: "Supplier availability confirmed before payment",
          updatedAt: new Date().toISOString(),
        },
      ];
      await put(db, "orders", order.id, order, order.customerId);
      await put(db, "sourcedSupply", order.id, {
        confirmed: true,
        confirmedBy: user!.id,
        confirmedAt: new Date().toISOString(),
        vendorId: vendor.id,
      });
      await enqueueMail(db, {
        eventKey: `sourced-order:${order.id}:supply-ready:customer`,
        eventType: "sourcing.supply_ready",
        recipient: order.customerEmail,
        template: "sourcing.supply_ready",
        data: { reference: order.reference, orderId: order.id },
      });
    });
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
