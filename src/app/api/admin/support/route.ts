import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database, transaction } from "@/server/db";
import {
  body,
  failure,
  HttpError,
  json,
  requireCapability,
  sameOrigin,
  viewer,
} from "@/server/http";
import { enqueueMail } from "@/server/mail/queue";
import { enqueueNotification } from "@/server/notifications";
import { writeAudit } from "@/server/audit";

export async function GET(request: Request) {
  try {
    requireCapability(await viewer(request.headers), "support.read");
    const threads = await database().query(
      `SELECT id,owner_id,email,subject,status,assignee,created_at,updated_at
       FROM support_thread WHERE test_scope=false
       ORDER BY updated_at DESC LIMIT 100`,
    );
    const output = [];
    for (const thread of threads.rows) {
      const messages = await database().query(
        `SELECT id,author_type,body,created_at FROM support_message
         WHERE thread_id=$1 ORDER BY created_at`,
        [thread.id],
      );
      output.push({
        id: thread.id,
        customerId: thread.owner_id,
        email: thread.email,
        subject: thread.subject,
        status: thread.status,
        assignee: thread.assignee,
        createdAt: new Date(thread.created_at).toISOString(),
        updatedAt: new Date(thread.updated_at).toISOString(),
        messages: messages.rows.map((message) => ({
          id: message.id,
          authorType: message.author_type,
          body: message.body,
          createdAt: new Date(message.created_at).toISOString(),
        })),
      });
    }
    return json(output);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireCapability(user, "support.write");
    const input = z
      .object({
        id: z.string().uuid(),
        reply: z.string().trim().min(1).max(5000).optional(),
        status: z.enum(["open", "waiting_on_customer", "resolved"]).optional(),
      })
      .refine((value) => value.reply || value.status, "Add a reply or status.")
      .parse(await body(request));
    await transaction(async (db) => {
      const found = await db.query(
        "SELECT * FROM support_thread WHERE id=$1 AND test_scope=false FOR UPDATE",
        [input.id],
      );
      const thread = found.rows[0];
      if (!thread) throw new HttpError(404, "Request not found.");
      if (input.reply) {
        await db.query(
          `INSERT INTO support_message(id,thread_id,author_id,author_type,body)
           VALUES($1,$2,$3,'staff',$4)`,
          [randomUUID(), input.id, user!.id, input.reply],
        );
      }
      const status = input.status ?? "waiting_on_customer";
      await db.query(
        "UPDATE support_thread SET status=$2,assignee=$3,updated_at=now() WHERE id=$1",
        [input.id, status, user!.email],
      );
      if (input.reply) {
        const eventKey = `support:${thread.id}:reply:${randomUUID()}`;
        await enqueueMail(db, {
          eventKey,
          eventType: "support.replied",
          recipient: thread.email,
          template: "support.reply",
          data: { subject: thread.subject, reply: input.reply },
        });
        await enqueueNotification(db, {
          ownerId: thread.owner_id,
          eventKey,
          type: "support.replied",
          title: "PAYDAN support replied",
          body: thread.subject,
          href: "/contact",
        });
      }
      await writeAudit(db, {
        actor: user!.email,
        action: input.reply ? "support.reply" : "support.status",
        record: input.id,
        capability: "support.write",
        source: "admin",
        after: { status },
      });
    });
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
