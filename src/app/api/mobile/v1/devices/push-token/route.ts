import { pushTokenSchema } from "@/mobile-contract/schemas";
import { database } from "@/server/db";
import {
  mobileBody,
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/**
 * PUT /api/mobile/v1/devices/push-token — register or replace the Expo
 * push token for this (user, device, environment).
 * DELETE — remove it (sign-out).
 */
export async function PUT(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-push:${user.id}`, 30);
    const input = pushTokenSchema.parse(await mobileBody(request));
    await database().query(
      `INSERT INTO push_token(owner_id,device_id,platform,app_environment,token)
VALUES($1,$2,$3,$4,$5)
ON CONFLICT(owner_id,device_id,app_environment)
DO UPDATE SET token=excluded.token,platform=excluded.platform,updated_at=now()`,
      [user.id, input.deviceId, input.platform, input.appEnvironment, input.token],
    );
    return mobileJson({ registered: true });
  } catch (error) {
    return mobileFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    const raw = await mobileBody(request).catch(() => ({}));
    const deviceId =
      typeof raw.deviceId === "string" ? raw.deviceId.slice(0, 150) : null;
    if (deviceId) {
      await database().query(
        "DELETE FROM push_token WHERE owner_id=$1 AND device_id=$2",
        [user.id, deviceId],
      );
    } else {
      await database().query("DELETE FROM push_token WHERE owner_id=$1", [
        user.id,
      ]);
    }
    return mobileJson({ removed: true });
  } catch (error) {
    return mobileFailure(error);
  }
}
