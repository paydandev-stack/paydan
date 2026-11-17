"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";

type Operations = {
  mail: { pending: string; dead: string; oldest: string | null };
  deadMail: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    failedAt: string;
    error: string | null;
  }>;
  payments: { pending: string; oldest: string | null };
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
};

export default function OperationsPage() {
  const [state, setState] = useState<Operations | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setState(await api<Operations>("/api/admin/operations"));
  }, []);
  useEffect(() => {
    void load().catch((reason) => setError((reason as Error).message));
  }, [load]);
  async function run(
    worker: "mail" | "payments" | "media" | "retry-dead-mail",
  ) {
    setBusy(worker);
    setError("");
    try {
      await api("/api/admin/operations", { worker });
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
    </>
  );
}
