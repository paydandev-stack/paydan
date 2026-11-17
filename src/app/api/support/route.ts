import { randomUUID } from "node:crypto";
import { z } from "zod";
import { transaction } from "@/server/db";
import { enqueueMail, enqueueOperationsAlert } from "@/server/mail/queue";
import {
  body,
  failure,
  HttpError,
  json,
  limit,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
import { isTestBuyer } from "@/server/test-buyer";

async function threadsFor(ownerId: string) {
  return transaction(async (db) => {
    const threads = await db.query(
      `SELECT id,subject,status,assignee,created_at,updated_at
       FROM support_thread WHERE owner_id=$1
       ORDER BY updated_at DESC LIMIT 50`,
      [ownerId],
    );
    const output = [];
    for (const thread of threads.rows) {
      const messages = await db.query(
        `SELECT id,author_type,body,created_at FROM support_message
         WHERE thread_id=$1 ORDER BY created_at`,
        [thread.id],
      );
      output.push({
        id: thread.id,
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
    return output;
  });
}

export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    requireUser(user);
    return json(await threadsFor(user.id));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    await limit(`support:${user.id}`, 12, 3600);
    const input = z
      .object({
        threadId: z.string().uuid().optional(),
        subject: z.string().trim().min(3).max(200).optional(),
        message: z.string().trim().min(1).max(5000),
      })
      .parse(await body(request));
    if (!input.threadId && !input.subject)
      throw new HttpError(400, "A subject is required for a new request.");

    const result = await transaction(async (db) => {
      const now = new Date().toISOString();
      const threadId = input.threadId ?? randomUUID();
      let subject = input.subject ?? "Support request";
      if (input.threadId) {
        const found = await db.query(
          "SELECT * FROM support_thread WHERE id=$1 FOR UPDATE",
          [input.threadId],
        );
        const thread = found.rows[0];
        if (!thread || thread.owner_id !== user.id)
          throw new HttpError(404, "Support request not found.");
        if (thread.status === "resolved")
          throw new HttpError(409, "This support request is resolved.");
        subject = thread.subject;
        await db.query(
          `UPDATE support_thread SET status='waiting_on_staff',updated_at=now()
           WHERE id=$1`,
          [threadId],
        );
      } else {
        await db.query(
          `INSERT INTO support_thread(id,owner_id,email,subject,status,test_scope,created_at,updated_at)
           VALUES($1,$2,$3,$4,'waiting_on_staff',$5,$6,$6)`,
          [threadId, user.id, user.email, subject, isTestBuyer(user), now],
        );
      }
      await db.query(
        `INSERT INTO support_message(id,thread_id,author_id,author_type,body)
         VALUES($1,$2,$3,'customer',$4)`,
        [randomUUID(), threadId, user.id, input.message],
      );

      if (!isTestBuyer(user)) {
        if (!input.threadId)
          await enqueueMail(db, {
            eventKey: `support:${threadId}:received:customer`,
            eventType: "support.received",
            recipient: user.email,
            template: "support.received",
            data: { reference: threadId.slice(0, 8) },
          });
        await enqueueOperationsAlert(db, {
          eventKey: `support:${threadId}:customer:${now}`,
          eventType: "support.received",
          title: input.threadId ? "Customer replied" : "New support request",
          message: `${user.name} wrote about “${subject}”.`,
          href: "/admin/support",
        });
      }
      return { reference: threadId.slice(0, 8), threadId };
    });
    return json(result);
  } catch (error) {
    return failure(error);
  }
}
