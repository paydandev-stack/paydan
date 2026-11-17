import { loadEnvConfig } from "@next/env";
import { database } from "../src/server/db";
import { processMailBatch } from "../src/server/mail/worker";
import { runRecordedWorker } from "../src/server/workers";
async function main() {
  loadEnvConfig(process.cwd());
  const result = await runRecordedWorker("mail", () => processMailBatch(50));
  console.log(JSON.stringify(result));
  await database().end();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
