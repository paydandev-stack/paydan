import { chatResponse, guestAssistantKey } from "@/server/assistant";
import { body, failure, limit, sameOrigin, viewer } from "@/server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    if (process.env.DATABASE_URL)
      await limit(
        `chat:${user?.id ?? guestAssistantKey(request)}`,
        user ? Number(process.env.ASSISTANT_RATE_LIMIT_USER || 30) : Number(process.env.ASSISTANT_RATE_LIMIT_GUEST || 12),
      );
    return chatResponse(user, await body(request), request.signal);
  } catch (error) {
    return failure(error);
  }
}
