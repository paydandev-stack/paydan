import { Pool, type PoolClient } from "pg";

const globalDb = globalThis as unknown as { paydanPool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("PostgreSQL is not configured. Set DATABASE_URL.");
  return (globalDb.paydanPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10000,
  }));
}
export async function transaction<T>(
  fn: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await database().connect();
  try {
    await db.query("BEGIN");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export type Queryable = Pick<PoolClient, "query">;
export async function records<T>(
  db: Queryable,
  kind: string,
  owner?: string,
): Promise<T[]> {
  const result = await db.query(
    "SELECT data FROM commerce_record WHERE kind=$1" +
      (owner === undefined ? "" : " AND owner_id=$2") +
      " ORDER BY updated_at DESC",
    owner === undefined ? [kind] : [kind, owner],
  );
  return result.rows.map((row) => row.data as T);
}
export async function record<T>(
  db: Queryable,
  kind: string,
  id: string,
  lock = false,
): Promise<T | undefined> {
  const result = await db.query(
    "SELECT data FROM commerce_record WHERE kind=$1 AND id=$2" +
      (lock ? " FOR UPDATE" : ""),
    [kind, id],
  );
  return result.rows[0]?.data;
}
export async function put(
  db: Queryable,
  kind: string,
  id: string,
  data: unknown,
  owner: string | null = null,
) {
  await db.query(
    "INSERT INTO commerce_record(kind,id,owner_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,owner_id=excluded.owner_id,updated_at=now()",
    [kind, id, owner, JSON.stringify(data)],
  );
}
