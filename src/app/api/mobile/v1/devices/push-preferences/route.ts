import { z } from "zod";
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

const categories = ["marketing", "sourcing", "support"] as const;

/**
 * GET — current non-essential push opt-outs.
 * PUT { category, optedOut } — set or clear an opt-out.
 * Transactional events (payment/order/refund) always send when a token exists.
 */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    const result = await database().query(
      "SELECT category FROM push_opt_out WHERE owner_id=$1",
      [user.id],
    );
    const optedOut = new Set(result.rows.map((row) => row.category as string));
    return mobileJson({
      preferences: categories.map((category) => ({
        category,
        optedOut: optedOut.has(category),
        // Transactional events cannot be disabled.
        locked: false,
      })),
    });
  } catch (error) {
    return mobileFailure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-push-prefs:${user.id}`, 30);
    const { category, optedOut } = z
      .object({
        category: z.enum(categories),
        optedOut: z.boolean(),
      })
      .parse(await mobileBody(request));
    if (optedOut) {
      await database().query(
        "INSERT INTO push_opt_out(owner_id,category) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [user.id, category],
      );
    } else {
      await database().query(
        "DELETE FROM push_opt_out WHERE owner_id=$1 AND category=$2",
        [user.id, category],
      );
    }
    return mobileJson({ category, optedOut });
  } catch (error) {
    return mobileFailure(error);
  }
}
