import { randomUUID } from "node:crypto";
import type { Order, ReturnRequest } from "@/lib/types";
import { database, put, record, transaction } from "./db";
import { HttpError, requireCapability, type Viewer } from "./http";
import { kobo } from "./schemas";
import { paystack } from "./payments";
import { enqueueMail, enqueueOperationsAlert } from "./mail/queue";
import { findOrderLine } from "@/lib/order-lines";
import { writeAudit } from "./audit";
import { enqueueNotification } from "./notifications";
const LARGE_REFUND_APPROVAL_KOBO = 25_000_000;

export async function refundReturn(
  user: Viewer,
  returnId: string,
  requestedAmountKobo?: number,
) {
  requireCapability(user, "refunds.issue");
  const prepared = await transaction(async (db) => {
    const request = await record<ReturnRequest>(db, "returns", returnId, true);
    if (!request || request.status !== "approved")
      throw new HttpError(
        409,
        "Approve this return before requesting a refund.",
      );
    const order = await record<Order>(db, "orders", request.orderId, true);
    if (!order || order.paymentStatus !== "paid")
      throw new HttpError(409, "A verified payment is required.");
    const prior = await db.query("SELECT * FROM refund WHERE return_id=$1", [
      returnId,
    ]);
    if (prior.rows.length) return { existing: true, ...prior.rows[0] };
    if (!request.lineId)
      throw new HttpError(
        409,
        "This legacy return needs an exact order line selected before refunding.",
      );
    const item = findOrderLine(order, request.lineId);
    if (!item) throw new HttpError(400, "Order item not found.");
    const maximumAmount = Math.floor(
      (kobo(item.unitPrice) *
        request.quantity *
        (kobo(order.subtotal) - kobo(order.discount))) /
        kobo(order.subtotal),
    );
    const amount = requestedAmountKobo ?? maximumAmount;
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > maximumAmount)
      throw new HttpError(
        400,
        `Refund must be between NGN 0.01 and NGN ${(maximumAmount / 100).toFixed(2)}.`,
      );
    if (amount > LARGE_REFUND_APPROVAL_KOBO && user.role !== "Super Admin")
      throw new HttpError(
        403,
        "Refunds above NGN 250,000 require Super Admin approval.",
      );
    const total = await db.query(
      "SELECT COALESCE(sum(amount_kobo),0) AS amount FROM refund WHERE order_id=$1 AND status<>'failed'",
      [order.id],
    );
    if (Number(total.rows[0].amount) + amount > kobo(order.total))
      throw new HttpError(409, "Refund exceeds the remaining paid amount.");
    const id = randomUUID();
    await db.query(
      "INSERT INTO refund(id,order_id,return_id,amount_kobo,status) VALUES($1,$2,$3,$4,'submitting')",
      [id, order.id, returnId, amount],
    );
    await writeAudit(db, {
      actor: user.email,
      action: "Requested refund",
      record: returnId,
      capability: "refunds.issue",
      source: "admin",
      after: {
        amountKobo: amount,
        partial: amount < maximumAmount,
      },
    });
    await put(
      db,
      "returns",
      request.id,
      {
        ...request,
        partialRefundAmount:
          amount < maximumAmount
            ? Number((amount / 100).toFixed(2))
            : undefined,
      },
      request.customerId,
    );
    return {
      id,
      reference: order.reference,
      amount_kobo: amount,
      existing: false,
    };
  });
  if (prepared.existing)
    return {
      status: prepared.status,
      message:
        "Refund already submitted. Check its status before taking further action.",
    };
  // A network timeout is ambiguous. Never submit a second refund automatically.
  let data: Record<string, any>;
  try {
    data = await paystack("/refund", "POST", {
      transaction: prepared.reference,
      amount: Number(prepared.amount_kobo),
      currency: "NGN",
      merchant_note: `PAYDAN refund ${prepared.id}`,
      customer_note: "Approved PAYDAN return",
    });
  } catch (error) {
    await database().query(
      "UPDATE refund SET status='submission_unknown',last_error=$2,updated_at=now() WHERE id=$1",
      [
        prepared.id,
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Provider request failed.",
      ],
    );
    throw error;
  }
  await database().query(
    "UPDATE refund SET provider_id=$2,status=$3,last_error=NULL,updated_at=now() WHERE id=$1",
    [prepared.id, String(data.id), String(data.status)],
  );
  return {
    status: data.status,
    message:
      "Refund submitted to Paystack. It is not marked refunded until confirmed.",
  };
}
export async function verifyRefund(providerId: string) {
  let data: Record<string, any>;
  try {
    data = await paystack(`/refund/${encodeURIComponent(providerId)}`);
  } catch (error) {
    await database().query(
      "UPDATE refund SET last_error=$2,updated_at=now() WHERE provider_id=$1",
      [
        providerId,
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Provider verification failed.",
      ],
    );
    throw error;
  }
  const local = await database().query(
    "SELECT * FROM refund WHERE provider_id=$1",
    [providerId],
  );
  const refund = local.rows[0];
  if (!refund) return; // Refunds created outside PAYDAN need operations reconciliation.
  if (
    Number(data.amount) !== Number(refund.amount_kobo) ||
    data.currency !== "NGN"
  )
    throw new HttpError(409, "Refund details do not match.");
  await transaction(async (db) => {
    const locked = await db.query(
      "SELECT * FROM refund WHERE id=$1 FOR UPDATE",
      [refund.id],
    );
    if (locked.rows[0].status === "processed") return;
    const order = await record<Order>(db, "orders", refund.order_id, true);
    if (!order || data.transaction?.reference !== order.reference)
      throw new HttpError(409, "Refund transaction does not match.");
    await db.query(
      "UPDATE refund SET status=$2,last_error=NULL,updated_at=now() WHERE id=$1",
      [refund.id, String(data.status)],
    );
    if (data.status !== "processed") return;
    const request = await record<ReturnRequest>(
      db,
      "returns",
      refund.return_id,
      true,
    );
    if (request) {
      request.status = "refunded";
      await put(db, "returns", request.id, request, request.customerId);
    }
    const total = await db.query(
      "SELECT COALESCE(sum(amount_kobo),0) AS amount FROM refund WHERE order_id=$1 AND status='processed'",
      [order.id],
    );
    if (Number(total.rows[0].amount) === kobo(order.total))
      order.paymentStatus = "refunded";
    order.timeline.push({
      label: "Return refund processed",
      at: new Date().toISOString(),
      done: true,
    });
    await put(db, "orders", order.id, order, order.customerId);
    await enqueueMail(db, {
      eventKey: `refund:${refund.id}:processed:customer`,
      eventType: "refund.processed",
      recipient: order.customerEmail,
      template: "refund.processed",
      data: { reference: order.reference, orderId: order.id },
    });
    await enqueueOperationsAlert(db, {
      eventKey: `refund:${refund.id}:processed`,
      eventType: "refund.processed",
      title: "Refund processed",
      message: `Paystack confirmed the refund for order ${order.reference}.`,
      href: "/admin/returns",
    });
    await enqueueNotification(db, {
      ownerId: order.customerId,
      eventKey: `refund:${refund.id}:processed`,
      type: "refund.processed",
      title: "Refund processed",
      body: `The refund for ${order.reference} has been processed.`,
      href: `/account/orders/${order.id}`,
    });
  });
}
