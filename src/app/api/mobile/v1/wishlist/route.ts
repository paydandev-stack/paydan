import { z } from "zod";
import { toViewerProducts } from "@/lib/catalog-dto";
import type { Product } from "@/lib/types";
import { command, account } from "@/server/commands";
import { database, record } from "@/server/db";
import { productRecordKind } from "@/server/test-buyer";
import {
  mobileBody,
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/** GET /api/mobile/v1/wishlist — viewer wishlist with priced projections. */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    const state = await account(database(), user);
    const db = database();
    const products: Product[] = [];
    for (const productId of state.wishlist.slice(0, 100)) {
      const product = await record<Product>(
        db,
        productRecordKind(user),
        productId,
      );
      if (product) products.push(product);
    }
    return mobileJson({
      wishlist: state.wishlist,
      products: toViewerProducts(products, { pricesVisible: true }),
    });
  } catch (error) {
    return mobileFailure(error);
  }
}

/** POST /api/mobile/v1/wishlist — toggle; requires idempotency `key`. */
export async function POST(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-wishlist:${user.id}`, 60);
    const { key, productId } = z
      .object({ key: z.string().uuid(), productId: z.string().min(1).max(150) })
      .parse(await mobileBody(request));
    await command(user, "toggleWishlist", [productId], key);
    const state = await account(database(), user);
    return mobileJson({ wishlist: state.wishlist });
  } catch (error) {
    return mobileFailure(error);
  }
}
