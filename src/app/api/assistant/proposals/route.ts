import { createCartProposal } from "@/server/assistant/proposals";
import {
  body,
  failure,
  json,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    return json(await createCartProposal(user!, await body(request)));
  } catch (error) {
    return failure(error);
  }
}
