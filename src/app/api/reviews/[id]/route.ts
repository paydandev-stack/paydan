import {
  body,
  failure,
  json,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
import { deleteOwnReview, editOwnReview } from "@/server/reviews";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    const { id } = await context.params;
    return json(await editOwnReview(user, id, await body(request)));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    const { id } = await context.params;
    return json(await deleteOwnReview(user, id));
  } catch (error) {
    return failure(error);
  }
}
