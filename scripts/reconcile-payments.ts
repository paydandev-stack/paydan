import { loadEnvConfig } from "@next/env";
import { database } from "../src/server/db";
import { verifyPayment } from "../src/server/payments";
import { verifyRefund } from "../src/server/refunds";
async function main() {
  loadEnvConfig(process.cwd());
  const db = database();
  const payments = await db.query(
    "SELECT reference FROM payment WHERE status='pending' ORDER BY created_at LIMIT 100",
  );
  let checked = 0;
  for (const p of payments.rows) {
    try {
      await verifyPayment(p.reference);
      checked++;
    } catch {
      console.error(
        "Payment needs reconciliation. See the operations console.",
      );
    }
  }
  const refunds = await db.query(
    "SELECT provider_id FROM refund WHERE provider_id IS NOT NULL AND status NOT IN ('processed','failed') LIMIT 100",
  );
  for (const r of refunds.rows) {
    try {
      await verifyRefund(r.provider_id);
    } catch {
      console.error("Refund needs reconciliation.");
    }
  }
  console.log(`Checked ${checked} pending payments.`);
  await db.end();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
