import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { database, put } from "../src/server/db";
async function main() {
  loadEnvConfig(process.cwd());
  const email = process.argv[2]?.toLowerCase();
  if (!email || !email.includes("@"))
    throw new Error(
      "Usage: npm run admin:bootstrap -- verified-email@example.com",
    );
  const db = database();
  const result = await db.query(
    'SELECT id,name,email,"emailVerified" FROM "user" WHERE lower(email)=$1',
    [email],
  );
  const user = result.rows[0];
  if (!user?.emailVerified)
    throw new Error("Create and verify this account first.");
  const existing = await db.query(
    "SELECT id FROM commerce_record WHERE kind='team' AND lower(data->>'email')=$1",
    [email],
  );
  const id = existing.rows[0]?.id ?? randomUUID();
  await put(db, "team", id, {
    id,
    name: user.name,
    email,
    role: "Super Admin",
    status: "active",
    lastActive: "",
  });
  console.log("Super administrator access assigned to the verified account.");
  await db.end();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
