import { chat } from "@/server/assistant";
import { body, failure, json, limit, sameOrigin, viewer } from "@/server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    if (process.env.DATABASE_URL)
      await limit(`chat:${user?.id ?? "guest"}`, user ? 20 : 30);
    return json(await chat(user, await body(request)));
  } catch (error) {
    return failure(error);
  }
}
