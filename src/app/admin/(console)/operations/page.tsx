"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";
import {
  ConfirmDialog,
  SectionCard,
  StatusBadge,
} from "@/components/admin/admin-controls";

type Operations = {
  mail: { pending: string; dead: string; oldest: string | null };
  deadMail: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    failedAt: string;
    error: string | null;
  }>;
  payments: { pending: string; stale?: string; oldest: string | null };
  refunds: { unresolved: string; missing_provider: string };
  media: { candidates: string };
  runs: Array<{
    worker: "mail" | "payments" | "media";
    status: string;
    startedAt: string;
    completedAt: string | null;
    metrics: Record<string, unknown>;
    errorClass: string | null;
  }>;
  trends: Array<{
    worker: string;
    status: string;
    durationMs: number | null;
    errorClass: string | null;
    startedAt: string;
  }>;
  schedules: Array<{ worker: string; cadence: string; nextRun: string }>;
  alerts: Array<{
    id: string;
    title: string;
    channel: string;
    enabled: boolean;
  }>;
};

export default function OperationsPage() {
  const [state, setState] = useState<Operations | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    action: () => void;
  }>(null);
  const load = useCallback(async () => {
    setState(await api<Operations>("/api/admin/operations"));
  }, []);
  useEffect(() => {
    void load().catch((reason) => setError((reason as Error).message));
  }, [load]);
  async function run(
    worker: "mail" | "payments" | "media" | "retry-dead-mail" | "retry-one",
    mailId?: string,
  ) {
    setBusy(worker);
    setError("");
    try {
      await api("/api/admin/operations", { worker, mailId });
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Jobs and recovery"
        description="Mail delivery, payment reconciliation and safely repeatable recovery runs."
      />
      {error ? <p className="form-error">{error}</p> : null}
      <div className="admin-panels">
        <section className="admin-card">
          <h2>Transactional email</h2>
          <p>
            {state?.mail.pending ?? "—"} queued · {state?.mail.dead ?? "—"} dead
          </p>
          <p>
            Oldest queued:{" "}
            {state?.mail.oldest ? formatDateTime(state.mail.oldest) : "None"}
          </p>
          <button
            className="admin-btn"
            disabled={Boolean(busy)}
            onClick={() => void run("mail")}
          >
            {busy === "mail" ? "Running…" : "Process mail now"}
          </button>
          <button
            className="admin-btn quiet"
            disabled={Boolean(busy) || !Number(state?.mail.dead ?? 0)}
            onClick={() => void run("retry-dead-mail")}
          >
            {busy === "retry-dead-mail" ? "Retrying…" : "Retry dead mail"}
          </button>
        </section>
        <section className="admin-card">
          <h2>Payments and refunds</h2>
          <p>{state?.payments.pending ?? "—"} pending payments</p>
          <p>
            {state?.refunds.unresolved ?? "—"} unresolved refunds ·{" "}
            {state?.refunds.missing_provider ?? "—"} missing provider IDs
          </p>
          <button
            className="admin-btn"
            disabled={Boolean(busy)}
            onClick={() => void run("payments")}
          >
            {busy === "payments" ? "Running…" : "Reconcile now"}
          </button>
        </section>
        <section className="admin-card">
          <h2>Catalogue media</h2>
          <p>
            {state?.media.candidates ?? "—"} finalized images are old enough for
            an orphan-reference check.
          </p>
          <button
            className="admin-btn"
            disabled={Boolean(busy)}
            onClick={() => void run("media")}
          >
            {busy === "media" ? "Checking…" : "Clean orphaned images"}
          </button>
        </section>
      </div>
      <section className="admin-card" style={{ marginTop: "1rem" }}>
        <h2>Dead mail</h2>
        {state?.deadMail.map((mail) => (
          <div className="queue-item" key={mail.id}>
            <span>
              <strong>{mail.eventType}</strong>
              <br />
              {mail.error || "Delivery failed"} · {mail.id}
            </span>
            <span>{formatDateTime(mail.failedAt)}</span>
            <button
              className="admin-btn quiet"
              type="button"
              onClick={() =>
                setConfirm({
                  title: "Retry this message?",
                  description:
                    "The message will be re-queued once. Suppressed recipients stay blocked.",
                  action: () => {
                    setConfirm(null);
                    void run("retry-one", mail.id);
                  },
                })
              }
            >
              Retry one
            </button>
          </div>
        ))}
        {state && state.deadMail.length === 0 ? <p>No dead messages.</p> : null}
      </section>
      <section className="admin-card" style={{ marginTop: "1rem" }}>
        <h2>Recent worker runs</h2>
        {state?.runs.map((run) => (
          <div className="queue-item" key={`${run.worker}-${run.startedAt}`}>
            <span>
              <strong>{run.worker}</strong>
              <br />
              {run.status}
              {run.errorClass ? ` · ${run.errorClass}` : ""}
            </span>
            <span>{formatDateTime(run.startedAt)}</span>
          </div>
        ))}
        {state && state.runs.length === 0 ? (
          <p>No worker runs recorded yet.</p>
        ) : null}
      </section>
      <SectionCard
        title="Deployed schedules"
        description="Cron schedules and the next expected run for each worker."
      >
        <div className="admin-meta">
          {(state?.schedules ?? []).map((schedule) => (
            <div key={schedule.worker}>
              <span>{schedule.worker}</span>
              <strong>{schedule.cadence}</strong>
              <small>Next {formatDateTime(schedule.nextRun)}</small>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Duration and error trend"
        description="Recent worker runs with observed duration and failure class."
      >
        <div className="admin-meta">
          {(state?.trends ?? []).slice(0, 12).map((trend, index) => (
            <div key={trend.startedAt + index}>
              <span>{trend.worker}</span>
              <strong>{trend.status}</strong>
              <small>
                {trend.durationMs === null
                  ? "Running"
                  : trend.durationMs + " ms"}
                {trend.errorClass ? " · " + trend.errorClass : ""}
              </small>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Alert delivery"
        description="Delivery targets for dead mail, stale payments and unresolved refunds."
      >
        {(state?.alerts ?? []).map((alert) => (
          <div className="queue-item" key={alert.id}>
            <span>
              <strong>{alert.title}</strong>
              <br />
              {alert.channel}
            </span>
            <StatusBadge
              value={alert.enabled ? "Enabled" : "Paused"}
              tone={alert.enabled ? "good" : "neutral"}
            />
          </div>
        ))}
        {!state?.alerts.length ? (
          <p className="admin-muted">No alert channels configured yet.</p>
        ) : null}
        <form
          className="admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void api("/api/admin/operations", {
              alert: {
                id: String(data.get("id") || ""),
                title: String(data.get("title") || ""),
                channel: String(data.get("channel") || ""),
                enabled: true,
              },
            })
              .then(load)
              .catch((reason) => setError((reason as Error).message));
          }}
        >
          <input name="id" placeholder="alert-key" required />
          <input name="title" placeholder="Alert title" required />
          <input name="channel" placeholder="ops@example.com" required />
          <button className="admin-btn secondary" type="submit">
            Save alert
          </button>
        </form>
      </SectionCard>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        busy={Boolean(busy)}
        confirmLabel="Retry message"
        onConfirm={() => confirm?.action()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
