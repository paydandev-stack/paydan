import { database, put, records, type Queryable } from "./db";
import type { Product } from "@/lib/types";
import { publishReadiness } from "./product-readiness";

type Schedule = {
  id: string;
  productId: string;
  publishAt: string;
  status: "scheduled" | "published" | "blocked" | "cancelled";
  issues?: string[];
};

export async function publishScheduledProducts(db: Queryable = database()) {
  const schedules = (
    await records<Partial<Schedule>>(db, "productMeta")
  ).filter(
    (item): item is Schedule =>
      typeof item.id === "string" &&
      item.id.startsWith("schedule:") &&
      typeof item.productId === "string" &&
      typeof item.publishAt === "string" &&
      item.status !== "published" &&
      item.status !== "cancelled" &&
      Date.parse(item.publishAt) <= Date.now(),
  );
  let published = 0;
  let blocked = 0;
  for (const schedule of schedules) {
    const product = await records<Product>(db, "products").then((items) =>
      items.find((item) => item.id === schedule.productId),
    );
    if (!product) {
      await put(db, "productMeta", schedule.id, {
        ...schedule,
        status: "cancelled",
      });
      continue;
    }
    const readiness = await publishReadiness(db, product);
    if (!readiness.ready) {
      await put(db, "productMeta", schedule.id, {
        ...schedule,
        status: "blocked",
        issues: readiness.issues,
      });
      blocked += 1;
      continue;
    }
    await put(db, "products", product.id, {
      ...product,
      status: "published",
      updatedAt: new Date().toISOString(),
    });
    await put(db, "productMeta", schedule.id, {
      ...schedule,
      status: "published",
      issues: [],
    });
    published += 1;
  }
  return { processed: schedules.length, published, blocked };
}
