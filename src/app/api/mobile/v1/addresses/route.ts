import { z } from "zod";
import { addressSchema } from "@/mobile-contract/schemas";
import { command, account } from "@/server/commands";
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

/** GET /api/mobile/v1/addresses — viewer address book. */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    const state = await account(database(), user);
    return mobileJson({ addresses: state.addresses });
  } catch (error) {
    return mobileFailure(error);
  }
}

/**
 * POST /api/mobile/v1/addresses — add/update/remove/set-default.
 * Requires idempotency `key`.
 */
export async function POST(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-addresses:${user.id}`, 60);
    const { key, op, address, addressId } = z
      .object({
        key: z.string().uuid(),
        op: z.enum(["add", "update", "remove", "setDefault"]),
        address: addressSchema.optional(),
        addressId: z.string().min(1).max(150).optional(),
      })
      .parse(await mobileBody(request));
    if (op === "add") {
      const value = addressSchema.parse(address);
      await command(
        user,
        "addAddress",
        [
          {
            label: value.label,
            recipient: value.recipient,
            phone: value.phone,
            street: value.street,
            landmark: value.landmark,
            city: value.city,
            state: value.state,
            isDefault: value.isDefault,
          },
        ],
        key,
      );
    } else if (op === "update") {
      if (!addressId) throw new Error("addressId is required.");
      const value = addressSchema.partial().omit({ id: true }).parse(address);
      await command(user, "updateAddress", [addressId, value], key);
    } else if (op === "remove") {
      if (!addressId) throw new Error("addressId is required.");
      await command(user, "removeAddress", [addressId], key);
    } else {
      if (!addressId) throw new Error("addressId is required.");
      await command(user, "setDefaultAddress", [addressId], key);
    }
    const state = await account(database(), user);
    return mobileJson({ addresses: state.addresses });
  } catch (error) {
    return mobileFailure(error);
  }
}
