import { z } from "zod";
import { revalidateTag } from "next/cache";
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
        "setProductStatus",
        "saveCategory",
        "updateCategory",
        "saveBanner",
        "toggleBanner",
        "updateSettings",
      ]).has(input.name)
    )
      revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
    return json({ result });
  } catch (error) {
    return failure(error);
  }
}
