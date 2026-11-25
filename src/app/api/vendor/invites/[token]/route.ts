import { failure, json, limit, sameOrigin } from "@/server/http";
import { claimVendorInvite, readVendorInvite } from "@/server/vendor-invites";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    await limit(
      "vendor-invite-read:" + request.headers.get("x-forwarded-for"),
      60,
    );
    return json(await readVendorInvite(token));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    sameOrigin(request);
    const { token } = await context.params;
    await limit(
      "vendor-invite-claim:" + request.headers.get("x-forwarded-for"),
      20,
    );
    return json(await claimVendorInvite(token));
  } catch (error) {
    return failure(error);
  }
}
