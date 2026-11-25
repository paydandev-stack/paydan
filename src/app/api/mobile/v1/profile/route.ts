import { profileUpdateSchema } from "@/mobile-contract/schemas";
import { command } from "@/server/commands";
import { auth } from "@/server/auth";
import {
  mobileBody,
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";
import { database } from "@/server/db";
import type { Viewer } from "@/server/http";

export const runtime = "nodejs";

async function profileFor(user: Viewer) {
  const db = database();
  const stored = await db.query(
    "SELECT data FROM commerce_record WHERE kind='customers' AND id=$1 LIMIT 1",
    [user.id],
  );
  const profile = (stored.rows[0]?.data ?? {}) as {
    phone?: string;
    city?: string;
    state?: string;
  };
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: profile.phone ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
  };
}

/** GET /api/mobile/v1/profile — viewer profile. */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    return mobileJson({ profile: await profileFor(user) });
  } catch (error) {
    return mobileFailure(error);
  }
}

/** PATCH /api/mobile/v1/profile — update name/phone/city/state. */
export async function PATCH(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-profile:${user.id}`, 30);
    const patch = profileUpdateSchema.parse(await mobileBody(request));
    if (patch.name) {
      await auth().api.updateUser({
        headers: request.headers,
        body: { name: patch.name },
      });
      user.name = patch.name;
    }
    const rest = { ...patch };
    delete rest.name;
    if (Object.keys(rest).length) {
      const { randomUUID } = await import("node:crypto");
      await command(user, "updateCustomer", [user.id, rest], randomUUID());
    }
    return mobileJson({ profile: await profileFor(user) });
  } catch (error) {
    return mobileFailure(error);
  }
}
