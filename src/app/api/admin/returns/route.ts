import { z } from "zod";
import { database } from "@/server/db";
import {
  body,
  failure,
  json,
  requireRole,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
import { refundReturn, verifyRefund } from "@/server/refunds";
export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    requireRole(user, ["Order Manager"]);
    return json(
      (
        await database().query(
          "SELECT * FROM refund ORDER BY created_at DESC LIMIT 100",
        )
      ).rows,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    requireRole(user, ["Order Manager"]);
    const input = await body(request);
    if (input.action === "verify") {
      const id = z.string().max(100).parse(input.providerId);
      await verifyRefund(id);
      return json({ message: "Refund status refreshed." });
    }
    return json(
      await refundReturn(user, z.string().uuid().parse(input.returnId)),
    );
  } catch (error) {
    return failure(error);
  }
}
