import { beginUpload, finalizeUpload } from "@/server/media";
import {
  body,
  failure,
  json,
  limit,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    await limit(`media:${user.id}`, 20);
    const data = await body(request);
    return json(
      data.action === "finalize"
        ? await finalizeUpload(user, z.string().uuid().parse(data.id))
        : await beginUpload(user, data),
    );
  } catch (error) {
    return failure(error);
  }
}
