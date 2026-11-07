import { z } from "zod";
import { database, record, transaction } from "@/server/db";
import type { Product } from "@/lib/types";
import {
  body,
  failure,
  HttpError,
  json,
  requireRole,
  sameOrigin,
  viewer,
} from "@/server/http";
export async function GET(request: Request) {
  try {
    requireRole(await viewer(request.headers), [
      "Catalog Manager",
      "Order Manager",
    ]);
    return json((await database().query("SELECT * FROM inventory")).rows);
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    requireRole(await viewer(request.headers), ["Catalog Manager"]);
    const value = z
      .object({
        productId: z.string().max(150),
        variantId: z.string().max(150),
        available: z.number().int().min(0).max(1000000),
      })
      .parse(await body(request));
    await transaction(async (db) => {
      const product = await record<Product>(db, "products", value.productId);
      if (!product?.variants.some((v) => v.id === value.variantId))
        throw new HttpError(404, "Variant not found.");
      await db.query(
        "INSERT INTO inventory(product_id,variant_id,available) VALUES($1,$2,$3) ON CONFLICT(product_id,variant_id) DO UPDATE SET available=excluded.available,updated_at=now()",
        [value.productId, value.variantId, value.available],
      );
    });
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
