import { z } from "zod";
import { database, put, records, transaction } from "@/server/db";
import {
  body,
  failure,
  HttpError,
  json,
  requireCapability,
  sameOrigin,
  viewer,
} from "@/server/http";
import { processMailBatch, retryDeadMail } from "@/server/mail/worker";
import { reconcilePayments } from "@/server/reconciliation";
import { runRecordedWorker } from "@/server/workers";
import { writeAudit } from "@/server/audit";
import { cleanupOrphanedCatalogMedia } from "@/server/media";

export async function GET(request: Request) {
  try {
    requireCapability(await viewer(request.headers), "jobs.read");
    const [mail, deadMail, payments, refunds, media, runs] = await Promise.all([
      database().query(
        `SELECT
          count(*) FILTER (WHERE sent_at IS NULL AND dead_at IS NULL) AS pending,
          count(*) FILTER (WHERE dead_at IS NOT NULL) AS dead,
          min(created_at) FILTER (WHERE sent_at IS NULL AND dead_at IS NULL) AS oldest
         FROM mail_outbox`,
      ),
      database().query(
        `SELECT id,event_type,created_at,dead_at,last_error
         FROM mail_outbox
         WHERE dead_at IS NOT NULL
         ORDER BY dead_at DESC LIMIT 20`,
      ),
      database().query(
        `SELECT
          count(*) FILTER (WHERE status='pending') AS pending,
          count(*) FILTER (
            WHERE status='pending' AND created_at < now() - interval '30 minutes'
          ) AS stale,
          min(created_at) FILTER (WHERE status='pending') AS oldest
         FROM payment`,
      ),
      database().query(
        `SELECT
          count(*) FILTER (WHERE status NOT IN ('processed','failed')) AS unresolved,
          count(*) FILTER (WHERE provider_id IS NULL AND status<>'failed') AS missing_provider
         FROM refund`,
      ),
      database().query(
        `SELECT count(*)::int AS candidates
         FROM media
         WHERE purpose='catalog' AND status='ready'
           AND object_key LIKE 'catalog/%'
           AND created_at < now() - interval '24 hours'`,
      ),
      database().query(
        `SELECT worker,status,started_at,completed_at,metrics,error_class
         FROM worker_run ORDER BY started_at DESC LIMIT 20`,
      ),
    ]);
    const trends = runs.rows.map((run) => ({
      worker: run.worker,
      status: run.status,
      durationMs: run.completed_at
        ? Math.round(Date.parse(run.completed_at) - Date.parse(run.started_at))
        : null,
      errorClass: run.error_class,
      startedAt: run.started_at,
    }));
    const schedules = [
      { worker: "mail", cadence: "Every 5 minutes", nextRun: nextRun(5) },
      { worker: "payments", cadence: "Every 15 minutes", nextRun: nextRun(15) },
      { worker: "push", cadence: "Every 5 minutes", nextRun: nextRun(5) },
      {
        worker: "products",
        cadence: "Every 10 minutes",
        nextRun: nextRun(10),
      },
      {
        worker: "sourcing",
        cadence: "Every 15 minutes",
        nextRun: nextRun(15),
      },
      { worker: "media", cadence: "Every 24 hours", nextRun: nextRun(1440) },
      { worker: "push", cadence: "Every 5 minutes", nextRun: nextRun(5) },
      {
        worker: "product-publishing",
        cadence: "Every 10 minutes",
        nextRun: nextRun(10),
      },
    ];
    return json({
      mail: mail.rows[0],
      deadMail: deadMail.rows.map((item) => ({
        id: item.id,
        eventType: item.event_type,
        createdAt: new Date(item.created_at).toISOString(),
        failedAt: new Date(item.dead_at).toISOString(),
        error: item.last_error,
      })),
      payments: payments.rows[0],
      refunds: refunds.rows[0],
      media: media.rows[0],
      runs: runs.rows.map((run) => ({
        worker: run.worker,
        status: run.status,
        startedAt: new Date(run.started_at).toISOString(),
        completedAt: run.completed_at
          ? new Date(run.completed_at).toISOString()
          : null,
        metrics: run.metrics,
        errorClass: run.error_class,
      })),
      trends,
      schedules,
      alerts: await records(database(), "jobAlerts"),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireCapability(user, "jobs.retry");
    const input = z
      .object({
        worker: z
          .enum(["mail", "payments", "media", "retry-dead-mail", "retry-one"])
          .optional(),
        mailId: z.string().uuid().optional(),
        alert: z
          .object({
            id: z.string().max(150),
            title: z.string().min(1).max(200),
            channel: z.string().min(1).max(100),
            enabled: z.boolean().default(true),
          })
          .optional(),
      })
      .parse(await body(request));
    if (input.alert) {
      const alert = {
        ...input.alert,
        updatedAt: new Date().toISOString(),
        updatedBy: user!.email,
      };
      await transaction(async (db) => {
        await put(db, "jobAlerts", alert.id, alert, user!.id);
        await writeAudit(db, {
          actor: user!.email,
          action: "jobs.alert",
          record: alert.id,
          capability: "jobs.retry",
          source: "admin",
          after: alert,
        });
      });
      return json({ saved: true });
    }
    const worker = input.worker;
    if (!worker) throw new HttpError(400, "Choose a worker or alert.");
    if (worker === "retry-one" && !input.mailId)
      throw new HttpError(400, "Choose a message to retry.");
    const result =
      worker === "mail"
        ? await runRecordedWorker("mail", () => processMailBatch(25))
        : worker === "retry-dead-mail"
          ? await runRecordedWorker("mail", async () => {
              const retried = await retryDeadMail(25);
              return { retried, ...(await processMailBatch(25)) };
            })
          : worker === "retry-one"
            ? await runRecordedWorker("mail", async () => {
                const retried = await retryDeadMail(1, input.mailId);
                return { retried, ...(await processMailBatch(25)) };
              })
            : worker === "media"
              ? await runRecordedWorker("media", () =>
                  cleanupOrphanedCatalogMedia(100),
                )
              : await runRecordedWorker("payments", () =>
                  reconcilePayments(50),
                );
    await writeAudit(database(), {
      actor: user!.email,
      action: "worker.manual-run",
      record: worker,
      capability: "jobs.retry",
      source: "admin",
      after: result,
    });
    return json(result);
  } catch (error) {
    return failure(error);
  }
}

function nextRun(minutes: number) {
  const date = new Date(Date.now() + minutes * 60_000);
  date.setSeconds(0, 0);
  return date.toISOString();
}
