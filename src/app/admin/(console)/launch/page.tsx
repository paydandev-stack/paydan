"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/status-pill";

type LaunchState = {
  ready: boolean;
  items: Array<{ key: string; label: string; ok: boolean; detail: string }>;
};

export default function LaunchPage() {
  const [state, setState] = useState<LaunchState | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void api<LaunchState>("/api/admin/launch")
      .then(setState)
      .catch((reason) => setError((reason as Error).message));
  }, []);
  return (
    <>
      <AdminPageHeader
        eyebrow="Release control"
        title="Launch readiness"
        description="Content, provider and operational checks that must pass before indexing is enabled."
      />
      {state ? (
        <div className="admin-note">
          <strong>
            {state.ready
              ? "Ready for final business acceptance"
              : "Launch is still gated"}
          </strong>
          <p>{state.items.filter((item) => !item.ok).length} checks remain.</p>
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
            </span>
            <StatusPill tone={item.ok ? "green" : "orange"}>
              {item.ok ? "Ready" : "Required"}
            </StatusPill>
          </div>
        ))}
      </section>
    </>
  );
}
