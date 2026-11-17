import "server-only";

import { database } from "./db";
import { verifyPayment } from "./payments";
import { verifyRefund } from "./refunds";
import { enqueueOperationsAlert } from "./mail/queue";

export async function reconcilePayments(limit = 100) {
  const bounded = Math.max(1, Math.min(limit, 100));
  const payments = await database().query(
    `SELECT reference,order_id,created_at FROM payment WHERE status='pending'
     ORDER BY created_at LIMIT $1`,
    [bounded],
  );
  let paymentsChecked = 0;
  let paymentsFailed = 0;
  for (const payment of payments.rows) {
    try {
      await verifyPayment(payment.reference);
      paymentsChecked += 1;
    } catch {
      paymentsFailed += 1;
      if (Date.now() - Date.parse(payment.created_at) > 15 * 60 * 1000)
        await enqueueOperationsAlert(database(), {
          eventKey: `payment:${payment.reference}:reconciliation-attention`,
          eventType: "payment.reconciliation_failed",
          title: "Payment needs reconciliation",
          message: `Payment ${payment.reference} could not be reconciled automatically.`,
          href: `/admin/orders/${payment.order_id}`,
        });
    }
  }

  const refunds = await database().query(
    `SELECT provider_id FROM refund
     WHERE provider_id IS NOT NULL AND status NOT IN ('processed','failed')
     ORDER BY created_at LIMIT $1`,
    [bounded],
  );
  let refundsChecked = 0;
  let refundsFailed = 0;
  for (const refund of refunds.rows) {
    try {
      await verifyRefund(refund.provider_id);
      refundsChecked += 1;
    } catch {
      refundsFailed += 1;
    }
  }
  return {
    paymentsFound: payments.rows.length,
    paymentsChecked,
    paymentsFailed,
    refundsFound: refunds.rows.length,
    refundsChecked,
    refundsFailed,
  };
}
