import { readFile, readdir } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "../src/server/auth";
import { database, transaction } from "../src/server/db";
async function main() {
  loadEnvConfig(process.cwd());
  // Long-running DDL and advisory locks should bypass PgBouncer when Neon (or
  // another provider) supplies a direct administrative connection.
  if (process.env.DATABASE_URL_UNPOOLED)
    process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
  const db = database();
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migration(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(88881234)");
      const done = await client.query(
        "SELECT name FROM schema_migration WHERE name=$1",
        [name],
      );
      if (done.rows.length) return;
      await client.query(await readFile(`migrations/${name}`, "utf8"));
      await client.query("INSERT INTO schema_migration(name) VALUES($1)", [
        name,
      ]);
      console.log(`Applied ${name}`);
    });
  }
  const plan = await getMigrations(auth().options);
  await plan.runMigrations();
  console.log("Auth schema is current.");
  await db.end();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
