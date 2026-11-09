import { randomUUID } from "node:crypto";
import { z } from "zod";
import { put, transaction } from "@/server/db";
import { enqueueMail, enqueueOperationsAlert } from "@/server/mail/queue";
import {
  body,
  failure,
  json,
  limit,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    await limit(`support:${user.id}`, 5, 3600);
    const input = z
      .object({
        subject: z.string().trim().min(3).max(200),
        message: z.string().trim().min(10).max(5000),
      })
      .parse(await body(request));
    const id = randomUUID();
    await transaction(async (db) => {
      await put(
        db,
        "support",
        id,
        {
          id,
          ...input,
          customerId: user.id,
          email: user.email,
          status: "open",
          createdAt: new Date().toISOString(),
        },
        user.id,
      );
      await enqueueMail(db, {
        eventKey: `support:${id}:received:customer`,
        eventType: "support.received",
        recipient: user.email,
        template: "support.received",
        data: { reference: id.slice(0, 8) },
      });
      await enqueueOperationsAlert(db, {
        eventKey: `support:${id}:received`,
        eventType: "support.received",
        title: "New support request",
        message: `${user.name} submitted “${input.subject}”.`,
        href: "/admin/support",
      });
    });
    return json({ reference: id.slice(0, 8) });
  } catch (error) {
    return failure(error);
  }
}
