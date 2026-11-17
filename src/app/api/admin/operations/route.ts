import { z } from "zod";
import { database } from "@/server/db";
import {
  body,
  failure,
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
    const { worker } = z
      .object({
        worker: z.enum(["mail", "payments", "media", "retry-dead-mail"]),
      })
      .parse(await body(request));
    const result =
      worker === "mail"
        ? await runRecordedWorker("mail", () => processMailBatch(25))
        : worker === "retry-dead-mail"
          ? await runRecordedWorker("mail", async () => {
              const retried = await retryDeadMail(25);
              return { retried, ...(await processMailBatch(25)) };
            })
          : worker === "media"
            ? await runRecordedWorker("media", () =>
                cleanupOrphanedCatalogMedia(100),
              )
            : await runRecordedWorker("payments", () => reconcilePayments(50));
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
