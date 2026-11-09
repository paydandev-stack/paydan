import "server-only";

import { categories } from "@/data/categories";
import { put, record, transaction } from "./db";

const DEPARTMENT_BOOTSTRAP_VERSION = 1;
const DEPARTMENT_BOOTSTRAP_ID = "production-departments";

/**
 * Installs the original department directory once without overwriting later
 * edits made in the operations portal. The marker also prevents an archived
 * or deliberately removed department from being recreated on a later run.
 */
export async function bootstrapProductionDepartments() {
  return transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      DEPARTMENT_BOOTSTRAP_ID,
    ]);
    const marker = await record<{ version: number }>(
      db,
      "systemState",
      DEPARTMENT_BOOTSTRAP_ID,
    );
    if (marker?.version === DEPARTMENT_BOOTSTRAP_VERSION)
      return { inserted: 0, alreadyCurrent: true };

    let inserted = 0;
    for (const category of categories) {
      const result = await db.query(
        "INSERT INTO commerce_record(kind,id,owner_id,data) VALUES('categories',$1,NULL,$2) ON CONFLICT(kind,id) DO NOTHING",
        [category.slug, JSON.stringify({ ...category, active: true })],
      );
      inserted += result.rowCount ?? 0;
    }
    await put(db, "systemState", DEPARTMENT_BOOTSTRAP_ID, {
      version: DEPARTMENT_BOOTSTRAP_VERSION,
      installedAt: new Date().toISOString(),
    });
    return { inserted, alreadyCurrent: false };
  });
}
