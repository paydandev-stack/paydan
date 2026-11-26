import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

const name = process.argv[2];
if (!name || !/^\d{3}_[a-z0-9_]+\.sql$/.test(name))
  throw new Error("Pass one migration filename, for example 009_example.sql.");

const connectionStrings = [
  process.env.DATABASE_URL,
  process.env.DATABASE_URL_UNPOOLED,
].filter((value, index, values) => value && values.indexOf(value) === index);
if (!connectionStrings.length) throw new Error("DATABASE_URL is required.");

const sql = await readFile(
  new URL(`../migrations/${name}`, import.meta.url),
  "utf8",
);
let lastError;

for (const connectionString of connectionStrings) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(88881234)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migration(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const done = await client.query(
      "SELECT name FROM schema_migration WHERE name=$1",
      [name],
    );
    if (done.rows.length) console.log(`${name} already applied.`);
    else {
      await client.query(sql);
      await client.query("INSERT INTO schema_migration(name) VALUES($1)", [name]);
      console.log(`Applied ${name}.`);
    }
    await client.query("COMMIT");
    lastError = undefined;
    break;
  } catch (error) {
    lastError = error;
    if (client) await client.query("ROLLBACK").catch(() => undefined);
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

if (lastError) {
  // Some restricted development environments block PostgreSQL sockets. Neon
  // also exposes an HTTPS SQL transport, which is suitable for this bounded,
  // non-interactive migration transaction.
  const http = neon(connectionStrings[0]);
  if (sql.includes("$$")) {
    throw new Error(
      "HTTPS fallback cannot safely split dollar-quoted migrations; run this migration over a PostgreSQL connection.",
      { cause: lastError },
    );
  }
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  const [record] = await http.query(
    "SELECT EXISTS(SELECT 1 FROM schema_migration WHERE name=$1) AS applied",
    [name],
  ).catch(async (error) => {
    if (error?.code !== "42P01") throw error;
    return [{ applied: false }];
  });

  if (record?.applied) console.log(`${name} already applied over HTTPS.`);
  else {
    await http.transaction((transaction) => [
      transaction`SELECT pg_advisory_xact_lock(88881234)`,
      transaction.query(
        "CREATE TABLE IF NOT EXISTS schema_migration(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
      ),
      ...statements.map((statement) => transaction.query(statement)),
      transaction.query(
        "INSERT INTO schema_migration(name) VALUES($1) ON CONFLICT(name) DO NOTHING",
        [name],
      ),
    ]);
    console.log(`Applied ${name} over HTTPS.`);
  }
}
