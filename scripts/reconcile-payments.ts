import { loadEnvConfig } from "@next/env";
import { database } from "../src/server/db";
import { reconcilePayments } from "../src/server/reconciliation";
import { runRecordedWorker } from "../src/server/workers";

async function main() {
  loadEnvConfig(process.cwd());
  const result = await runRecordedWorker("payments", () =>
    reconcilePayments(100),
  );
  console.log(JSON.stringify(result));
  await database().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Worker failed.");
  process.exitCode = 1;
});
