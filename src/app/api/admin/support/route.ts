import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Order, ReturnRequest } from "@/lib/types";
import { database, put, record, records, transaction } from "@/server/db";
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

type SupportMeta = {
  id: string;
  priority: "low" | "normal" | "high" | "urgent";
  readAt?: string;
  notes: Array<{
    id: string;
    body: string;
    author: string;
    at: string;
  }>;
};

export async function GET(request: Request) {
  try {
    requireCapability(await viewer(request.headers), "support.read");
    const url = new URL(request.url);
    const text = z.string().trim().max(100).optional();
    const q = text.parse(url.searchParams.get("q") || undefined);
    const status = text.parse(url.searchParams.get("status") || undefined);
    const assignee = text.parse(url.searchParams.get("assignee") || undefined);
    const priority = z
      .enum(["low", "normal", "high", "urgent"])
      .optional()
      .parse(url.searchParams.get("priority") || undefined);
    const cursor = z
      .string()
      .datetime()
      .optional()
      .parse(url.searchParams.get("cursor") || undefined);
    const db = database();
    const threads = await db.query(
      `SELECT t.id,t.owner_id,t.email,t.subject,t.status,t.assignee,
              t.created_at,t.updated_at,COALESCE(m.data,'{}'::jsonb) AS meta
       FROM support_thread t
       LEFT JOIN commerce_record m ON m.kind='supportMeta' AND m.id=t.id::text
       WHERE t.test_scope=false
         AND ($1::text IS NULL OR t.email ILIKE '%' || $1 || '%' OR t.subject ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR t.status=$2)
         AND ($3::text IS NULL OR ($3='unassigned' AND t.assignee IS NULL) OR t.assignee=$3)
         AND ($4::text IS NULL OR COALESCE(m.data->>'priority','normal')=$4)
         AND ($5::timestamptz IS NULL OR t.updated_at < $5)
       ORDER BY t.updated_at DESC LIMIT 26`,
      [
        q ?? null,
        status ?? null,
        assignee ?? null,
        priority ?? null,
        cursor ?? null,
      ],
    );
    const hasMore = threads.rows.length > 25;
    const pageRows = threads.rows.slice(0, 25);
    const ids = pageRows.map((thread) => thread.id);
    const messages = ids.length
      ? await db.query(
          `SELECT id,thread_id,author_type,body,created_at
           FROM support_message WHERE thread_id=ANY($1::uuid[])
           ORDER BY created_at`,
          [ids],
        )
      : { rows: [] as Array<Record<string, unknown>> };
    const [orders, returns, canned] = await Promise.all([
      records<Order>(db, "orders"),
      records<ReturnRequest>(db, "returns"),
      records<{ id: string; label: string; body: string }>(
        db,
        "supportCannedReplies",
      ),
    ]);
    const defaults = [
      {
        id: "acknowledge",
        label: "Acknowledge request",
        body: "Thank you for contacting PAYDAN. We are reviewing this and will update you shortly.",
      },
      {
        id: "order-check",
        label: "Order investigation",
        body: "We are checking the order with our operations team and will reply as soon as we have a confirmed update.",
      },
      {
        id: "resolved",
        label: "Resolution follow-up",
        body: "We have completed the requested action. Please reply if you still need help.",
      },
    ];
    return json({
      tickets: pageRows.map((thread) => {
        const meta = thread.meta as Partial<SupportMeta>;
        const threadMessages = messages.rows.filter(
          (message) => message.thread_id === thread.id,
        );
        const lastCustomer = threadMessages
          .filter((message) => message.author_type === "customer")
          .at(-1);
        const unread = Boolean(
          lastCustomer &&
          (!meta.readAt ||
            Date.parse(String(lastCustomer.created_at)) >
              Date.parse(meta.readAt)),
        );
        return {
          id: thread.id,
          customerId: thread.owner_id,
          email: thread.email,
          subject: thread.subject,
          status: thread.status,
          assignee: thread.assignee,
          priority: meta.priority ?? "normal",
          unread,
          createdAt: new Date(thread.created_at).toISOString(),
          updatedAt: new Date(thread.updated_at).toISOString(),
          context: {
            orders: orders.filter(
              (order) => order.customerId === thread.owner_id,
            ).length,
            returns: returns.filter(
              (item) => item.customerId === thread.owner_id,
            ).length,
          },
          internalNotes: meta.notes ?? [],
          messages: threadMessages.map((message) => ({
            id: message.id,
            authorType: message.author_type,
            body: message.body,
            createdAt: new Date(String(message.created_at)).toISOString(),
          })),
        };
      }),
      nextCursor: hasMore
        ? new Date(pageRows.at(-1).updated_at).toISOString()
        : null,
      cannedReplies: canned.length ? canned : defaults,
    });
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
        internalNote: z.string().trim().min(1).max(5000).optional(),
        status: z
          .enum(["open", "waiting_on_customer", "waiting_on_staff", "resolved"])
          .optional(),
        assignee: z.union([z.email(), z.literal("")]).optional(),
        claim: z.boolean().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        read: z.boolean().optional(),
      })
      .refine(
        (value) =>
          value.reply ||
          value.internalNote ||
          value.status ||
          value.assignee !== undefined ||
          value.claim ||
          value.priority ||
          value.read !== undefined,
        "Choose a support action.",
      )
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
      const beforeMeta = await record<SupportMeta>(db, "supportMeta", input.id);
      const meta: SupportMeta = {
        id: input.id,
        priority: input.priority ?? beforeMeta?.priority ?? "normal",
        readAt:
          input.read === true
            ? new Date().toISOString()
            : input.read === false
              ? undefined
              : beforeMeta?.readAt,
        notes: [
          ...(beforeMeta?.notes ?? []),
          ...(input.internalNote
            ? [
                {
                  id: randomUUID(),
                  body: input.internalNote,
                  author: user!.email,
                  at: new Date().toISOString(),
                },
              ]
            : []),
        ],
      };
      await put(db, "supportMeta", input.id, meta, thread.owner_id);
      const status =
        input.status ?? (input.reply ? "waiting_on_customer" : thread.status);
      const assignee = input.claim
        ? user!.email
        : input.assignee !== undefined
          ? input.assignee || null
          : input.reply
            ? thread.assignee || user!.email
            : thread.assignee;
      await db.query(
        "UPDATE support_thread SET status=$2,assignee=$3,updated_at=CASE WHEN $4::boolean THEN now() ELSE updated_at END WHERE id=$1",
        [
          input.id,
          status,
          assignee,
          Boolean(
            input.reply ||
            input.internalNote ||
            input.status ||
            input.assignee !== undefined ||
            input.claim ||
            input.priority,
          ),
        ],
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
        action: input.reply
          ? "support.reply"
          : input.internalNote
            ? "support.internal-note"
            : "support.update",
        record: input.id,
        capability: "support.write",
        source: "admin",
        before: {
          status: thread.status,
          assignee: thread.assignee,
          meta: beforeMeta,
        },
        after: { status, assignee, meta },
      });
    });
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
