import { loadEnvConfig } from "@next/env";
import { database, transaction } from "../src/server/db";

async function main() {
  loadEnvConfig(process.cwd());
  if (process.env.ALLOW_LOCAL_SEED !== "true")
    throw new Error(
      "Refusing to seed local commerce state without ALLOW_LOCAL_SEED=true.",
    );

  await transaction(async (db) => {
    const products = await db.query(
      "SELECT data FROM commerce_record WHERE kind='products' AND data->>'status'='published' AND COALESCE((data->>'restricted')::boolean,false)=false",
    );
    for (const row of products.rows) {
      const product = row.data as {
        id: string;
        variants?: Array<{ id: string }>;
      };
      for (const variant of product.variants ?? [])
        await db.query(
          "INSERT INTO inventory(product_id,variant_id,available) VALUES($1,$2,25) ON CONFLICT(product_id,variant_id) DO NOTHING",
          [product.id, variant.id],
        );
    }

    await db.query(
      "UPDATE commerce_record SET data=jsonb_set(data,'{active}','true'::jsonb),updated_at=now() WHERE kind='shippingZones' AND lower(data->>'state')='lagos'",
    );
  });

  console.log(
    "Local test stock is ready and the Lagos delivery zone is active.",
  );
  await database().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
