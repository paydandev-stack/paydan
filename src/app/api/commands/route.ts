import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { command } from "@/server/commands";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/server/public-catalog";
import {
  body,
  failure,
  json,
  limit,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    await limit(`commands:${user.id}`, 100);
    const input = z
      .object({
        name: z.string().max(80),
        args: z.array(z.unknown()).max(8),
        key: z.string().min(8).max(150),
      })
      .parse(await body(request));
    const result = await command(user, input.name, input.args, input.key);
    if (
      new Set([
        "saveProduct",
        "deleteProduct",
        "setProductStatus",
        "saveCategory",
        "updateCategory",
        "saveBanner",
        "toggleBanner",
        "updateSettings",
        "saveVendorProduct",
        "saveVendorStock",
      ]).has(input.name)
    ) {
      revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
      // Product and department names also appear in layouts, navigation,
      // metadata and cached storefront pages. Purge those rendered snapshots
      // with the data tag so an admin edit is visible on the next request.
      revalidatePath("/", "layout");
    }
    return json({ result });
  } catch (error) {
    return failure(error);
  }
}
