import { z } from "zod";
import {
  cartMutationSchema,
  type MobileCartMutation,
} from "@/mobile-contract/schemas";
import { command, account } from "@/server/commands";
import { database } from "@/server/db";
import {
  mobileBody,
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

const mutationToCommand = (
  mutation: MobileCartMutation,
): { name: string; args: unknown[] } => {
  switch (mutation.op) {
    case "add":
      return {
        name: "addToCart",
        args: [mutation.productId, mutation.variantId, mutation.quantity],
      };
    case "setQuantity":
      return {
        name: "setQuantity",
        args: [mutation.productId, mutation.variantId, mutation.quantity],
      };
    case "remove":
      return {
        name: "removeLine",
        args: [mutation.productId, mutation.variantId],
      };
    case "clear":
      return { name: "clearCart", args: [] };
    case "toggleWishlist":
      return { name: "toggleWishlist", args: [mutation.productId] };
    case "recordView":
      return { name: "recordProductView", args: [mutation.productId] };
  }
};

/**
 * GET /api/mobile/v1/cart — viewer cart + wishlist + saved-for-later.
 * PATCH /api/mobile/v1/cart — idempotent mutation; requires `key`.
 */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    const state = await account(database(), user);
    return mobileJson({
      cart: state.cart,
      wishlist: state.wishlist,
      savedForLater: state.savedForLater,
      recentlyViewed: state.recentlyViewed,
    });
  } catch (error) {
    return mobileFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-cart:${user.id}`, 60);
    const raw = await mobileBody(request);
    const { key, mutation } = z
      .object({ key: z.string().uuid(), mutation: cartMutationSchema })
      .parse(raw);
    const { name, args } = mutationToCommand(mutation);
    await command(user, name, args, key);
    const state = await account(database(), user);
    return mobileJson({
      cart: state.cart,
      wishlist: state.wishlist,
      savedForLater: state.savedForLater,
      recentlyViewed: state.recentlyViewed,
    });
  } catch (error) {
    return mobileFailure(error);
  }
}
