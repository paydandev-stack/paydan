import { loadEnvConfig } from "@next/env";
import { bootstrapProductionDepartments } from "../src/server/departments";
import { database } from "../src/server/db";

async function main() {
  loadEnvConfig(process.cwd());
  const result = await bootstrapProductionDepartments();
  console.log(
    result.alreadyCurrent
      ? "Production departments are already installed."
      : `Production departments installed (${result.inserted} new records).`,
  );
  await database().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
