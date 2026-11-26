import { cancelCartProposal } from "@/server/assistant/proposals";
import {
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-proposal:${user.id}`, 30);
    const { id } = await context.params;
    return mobileJson(await cancelCartProposal(user, { proposalId: id }));
  } catch (error) {
    return mobileFailure(error);
  }
}
