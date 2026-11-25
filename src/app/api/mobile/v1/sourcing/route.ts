import { z } from "zod";
import { sourcingSubmitSchema } from "@/mobile-contract/schemas";
import { command } from "@/server/commands";
import { database, record, records } from "@/server/db";
import { HttpError } from "@/server/http";
import { customerRequest } from "@/server/snapshot";
import { scopedRecordKind } from "@/server/test-buyer";
import { sourcing } from "@/server/schemas";
import type { SourcingRequest } from "@/lib/types";
import {
  mobileBody,
  mobileFailure,
  mobileJson,
  mobileLimit,
  mobileViewer,
  requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/** GET /api/mobile/v1/sourcing — viewer sourcing requests. */
export async function GET(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    const rows = await records<SourcingRequest>(
      database(),
      scopedRecordKind(user, "sourcing"),
      user.id,
    );
    return mobileJson({ sourcing: rows.map(customerRequest) });
  } catch (error) {
    return mobileFailure(error);
  }
}

/**
 * POST /api/mobile/v1/sourcing — submit a request, or respond to a quote.
 * `{ respond: { requestId, decision } }` accepts/declines a sent quote.
 * Idempotent on `key` for submissions.
 */
export async function POST(request: Request) {
  try {
    const user = await mobileViewer(request);
    requireMobileUser(user);
    await mobileLimit(`mobile-sourcing:${user.id}`, 20);
    const raw = await mobileBody(request);
    if (raw.respond) {
      const { requestId, decision } = z
        .object({
          requestId: z.string().min(1).max(150),
          decision: z.enum(["accepted", "declined"]),
        })
        .parse(raw.respond);
      const existing = await record<SourcingRequest>(
        database(),
        scopedRecordKind(user, "sourcing"),
        requestId,
      );
      if (!existing || existing.customerId !== user.id)
        throw new HttpError(404, "Sourcing request not found.");
      await command(
        user,
        "respondToQuote",
        [requestId, decision],
        z.string().uuid().parse(raw.key),
      );
      const updated = await record<SourcingRequest>(
        database(),
        scopedRecordKind(user, "sourcing"),
        requestId,
      );
      return mobileJson({
        sourcing: updated ? customerRequest(updated) : null,
      });
    }
    const parsed = sourcingSubmitSchema.parse(raw);
    const value = sourcing.parse({
      customerName: parsed.customerName,
      email: parsed.email,
      phone: parsed.phone,
      productName: parsed.productName,
      categorySlug: parsed.categorySlug,
      description: parsed.description,
      quantity: parsed.quantity,
      budget: parsed.budget,
      city: parsed.city,
      state: parsed.state,
      images: parsed.images,
    });
    const reference = (await command(
      user,
      "submitSourcing",
      [value],
      parsed.key,
    )) as string;
    // Fetch the created request by reference for the response.
    const rows = await records<SourcingRequest>(
      database(),
      scopedRecordKind(user, "sourcing"),
      user.id,
    );
    const created = rows.find((row) => row.reference === reference);
    return mobileJson({
      reference,
      sourcing: created ? customerRequest(created) : null,
    });
  } catch (error) {
    return mobileFailure(error);
  }
}
