"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";

type Page = { entries: AuditEntry[]; nextCursor: string | null };

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(
    async (next?: string, append = false) => {
      const query = new URLSearchParams();
      if (next) query.set("cursor", next);
      if (action.trim()) query.set("action", action.trim());
      const page = await api<Page>(`/api/admin/audit?${query}`);
      setEntries((current) =>
        append ? [...current, ...page.entries] : page.entries,
      );
      setCursor(page.nextCursor);
    },
    [action],
  );
  useEffect(() => {
    void load().catch((reason) => setError((reason as Error).message));
  }, [load]);
  return (
    <>
      <AdminPageHeader
        eyebrow="Insight"
        title="Audit trail"
        description="Authorized staff and worker changes with actor, capability and record context."
      />
      <form
        className="admin-actions"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="Filter by action"
        />
        <button className="admin-btn">Filter</button>
        <a
          className="admin-btn quiet"
          href={`/api/admin/audit?format=csv${action.trim() ? `&action=${encodeURIComponent(action.trim())}` : ""}`}
        >
          Export CSV
        </a>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="admin-card" style={{ marginTop: "1rem" }}>
        {entries.map((entry) => (
          <div className="queue-item" key={entry.id}>
            <span>
              <strong>{entry.action}</strong>
              <br />
              {entry.record || "—"} · {entry.actor}
              {entry.capability ? ` · ${entry.capability}` : ""}
            </span>
            <span>{formatDateTime(entry.at)}</span>
          </div>
        ))}
        {!entries.length ? <p>No matching audit entries.</p> : null}
        {cursor ? (
          <button
            className="admin-btn quiet"
            onClick={() => void load(cursor, true)}
          >
            Load older entries
          </button>
        ) : null}
      </section>
    </>
  );
}
