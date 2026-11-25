"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";

type LaunchState = {
  ready: boolean;
  checkedAt: string;
  items: Array<{
    key: string;
    label: string;
    ok: boolean;
    detail: string;
    owner: string;
    href: string;
  }>;
};

export default function LaunchPage() {
  const [state, setState] = useState<LaunchState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const runChecks = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setState(await api<LaunchState>("/api/admin/launch", { method: "POST" }));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void runChecks();
  }, [runChecks]);
  return (
    <>
      <AdminPageHeader
        eyebrow="Release control"
        title="Launch readiness"
        description="Run content, provider and operational checks, then open the exact section responsible for each failure."
        action={
          <button
            className="admin-btn primary"
            type="button"
            disabled={busy}
            onClick={() => void runChecks()}
          >
            {busy ? "Running checks…" : "Run checks"}
          </button>
        }
      />
      {state ? (
        <div className={state.ready ? "admin-notice" : "admin-note"}>
          <strong>
            {state.ready
              ? "Ready for final business acceptance"
              : "Launch is still gated"}
          </strong>
          <p>
            {state.items.filter((item) => !item.ok).length} checks remain · last
            run {formatDateTime(state.checkedAt)}
          </p>
        </div>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <section className="admin-card" style={{ marginTop: "1rem" }}>
        {state?.items.map((item) => (
          <div className="queue-item" key={item.key}>
            <span>
              <strong>{item.label}</strong>
              <br />
              {item.detail}
              <br />
              <small style={{ color: "var(--muted)" }}>
                Owner: {item.owner}
              </small>
            </span>
            <span className="admin-actions">
              <StatusPill tone={item.ok ? "green" : "orange"}>
                {item.ok ? "Ready" : "Required"}
              </StatusPill>
              <Link className="admin-btn quiet" href={item.href}>
                Open
              </Link>
            </span>
          </div>
        ))}
      </section>
      <div className="admin-note" style={{ marginTop: "1rem" }}>
        Storage readiness requires the configured CDN origin to be a complete
        HTTPS URL plus a recorded browser upload, finalize, delivery and private
        media acceptance run. The connected-services check verifies bucket and
        CDN connectivity without creating test objects.
      </div>
    </>
  );
}
