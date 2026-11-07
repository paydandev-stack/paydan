import { loadEnvConfig } from "@next/env";
import { database, put, transaction } from "../src/server/db";
import { products } from "../src/data/products";
import { categories } from "../src/data/categories";
import { vendors } from "../src/data/vendors";
import { seedBanners } from "../src/data/promotions";
import { shippingZones } from "../src/data/seed";
async function main() {
  loadEnvConfig(process.cwd());
  if (
    process.env.ALLOW_SAMPLE_CATALOG !== "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.ALLOW_LOCAL_SEED !== "true")
  )
    throw new Error(
      "Sample catalog seeding is for controlled local/test databases only.",
    );
  const loaded = await transaction(async (db) => {
    const existing = await db.query(
      "SELECT id FROM commerce_record WHERE kind='products' LIMIT 1",
    );
    if (existing.rows.length) {
      console.log("Catalog already contains products; leaving it unchanged.");
      return false;
    }
    for (const p of products) await put(db, "products", p.id, p);
    for (const c of categories) await put(db, "categories", c.slug, c);
    for (const v of vendors) await put(db, "vendors", v.id, v);
    for (const b of seedBanners) await put(db, "banners", b.id, b);
    for (const zone of shippingZones)
      await put(db, "shippingZones", zone.id, { ...zone, active: false });
    return true;
  });
  if (loaded)
    console.log(
      "Sample catalog loaded. Shipping is inactive; inventory is zero until the local-state seed runs. No customer, order or team fixtures were loaded.",
    );
  await database().end();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
