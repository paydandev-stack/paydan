import { chatResponse, guestAssistantKey } from "@/server/assistant";
import {
  mobileBody,
  mobileFailure,
  mobileLimit,
  mobileViewer,
} from "@/server/mobile-http";
import { assistantInputSchema } from "@/mobile-contract/schemas";

export const runtime = "nodejs";

/**
 * POST /api/mobile/v1/assistant
 * Same NDJSON protocol as web (`text-delta/tool-result/reply/done/error`).
 * Guests get price-free answers; members get viewer-scoped data.
 * The client must support cancellation via AbortController.
 */
export async function POST(request: Request) {
  try {
    const user = await mobileViewer(request);
    if (process.env.DATABASE_URL)
      await mobileLimit(
        `mobile-chat:${user?.id ?? guestAssistantKey(request)}`,
        user
          ? Number(process.env.ASSISTANT_RATE_LIMIT_USER || 30)
          : Number(process.env.ASSISTANT_RATE_LIMIT_GUEST || 12),
      );
    const raw = await mobileBody(request);
    const input = assistantInputSchema.parse(raw);
    return chatResponse(user, input, request.signal);
  } catch (error) {
    return mobileFailure(error);
  }
}
