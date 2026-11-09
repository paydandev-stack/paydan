import { loadEnvConfig } from "@next/env";
import { database } from "../src/server/db";
import { processMailBatch } from "../src/server/mail/worker";
async function main() {
  loadEnvConfig(process.cwd());
  const result = await processMailBatch(50);
  console.log(JSON.stringify(result));
  await database().end();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
