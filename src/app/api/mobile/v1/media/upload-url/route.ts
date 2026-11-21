import { beginUpload, finalizeUpload } from "@/server/media";
import { z } from "zod";
import {
  mobileBody,
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/**
 * POST /api/mobile/v1/media/upload-url — short-lived presigned upload
 * authorization for sourcing/return images. Server repeats authoritative
 * validation, re-encoding, and metadata stripping on finalize.
 */
export async function POST(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-media:${user.id}`, 20);
    const data = await mobileBody(request);
    if (data.action === "finalize") {
      return mobileJson(
        await finalizeUpload(user, z.string().uuid().parse(data.id)),
      );
    }
    return mobileJson(await beginUpload(user, data));
  } catch (error) {
    return mobileFailure(error);
  }
}
