import { confirmAssistantProposal } from "@/server/assistant";
import {
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/**
 * POST /api/mobile/v1/assistant/proposals/:id/confirm
 * Explicit user confirmation for a cart proposal. Owner-scoped, single-use
 * semantics live in `confirmAssistantProposal` (15-min expiry, reuse
 * returns `{ confirmed: true }`).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-proposal:${user.id}`, 30);
    const { id } = await context.params;
    return mobileJson(
      await confirmAssistantProposal(user, { proposalId: id }),
    );
  } catch (error) {
    return mobileFailure(error);
  }
}
