import { z } from "zod";
import { database, put, record, records, transaction } from "@/server/db";
import {
  body,
  failure,
  HttpError,
  json,
  requireRole,
  sameOrigin,
  viewer,
} from "@/server/http";
import { enqueueMail } from "@/server/mail/queue";
export async function GET(request: Request) {
  try {
    requireRole(await viewer(request.headers), ["Support"]);
    return json(await records(database(), "support"));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    requireRole(await viewer(request.headers), ["Support"]);
    const input = z
      .object({
        id: z.string().uuid(),
        reply: z.string().trim().min(1).max(5000),
      })
      .parse(await body(request));
    await transaction(async (db) => {
      const ticket = await record<{
        id: string;
        customerId: string;
        email: string;
        status: string;
        subject: string;
        reply?: string;
      }>(db, "support", input.id, true);
      if (!ticket) throw new HttpError(404, "Request not found.");
      if (ticket.status === "replied")
        throw new HttpError(409, "This request already has a reply.");
      ticket.reply = input.reply;
      ticket.status = "replied";
      await put(db, "support", input.id, ticket, ticket.customerId);
      await enqueueMail(db, {
        eventKey: `support:${ticket.id}:reply:customer`,
        eventType: "support.replied",
        recipient: ticket.email,
        template: "support.reply",
        data: { subject: ticket.subject, reply: input.reply },
      });
    });
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
