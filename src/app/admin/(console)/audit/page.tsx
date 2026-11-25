"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";

type Page = { entries: AuditEntry[]; nextCursor: string | null };
type Filters = {
  action: string;
  actor: string;
  capability: string;
  source: string;
  record: string;
  from: string;
  to: string;
};
const EMPTY: Filters = {
  action: "",
  actor: "",
  capability: "",
  source: "",
  record: "",
  from: "",
  to: "",
};

function paramsFor(filters: Filters, cursor?: string) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value.trim()) query.set(key, value.trim());
  if (cursor) query.set("cursor", cursor);
  return query;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [savedViews, setSavedViews] = useState<
    Array<{ name: string; filters: Filters }>
  >([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    async (next?: string, append = false) => {
      const page = await api<Page>(
        `/api/admin/audit?${paramsFor(filters, next)}`,
      );
      setEntries((current) =>
        append ? [...current, ...page.entries] : page.entries,
      );
      setCursor(page.nextCursor);
    },
    [filters],
  );
  useEffect(() => {
    try {
      setSavedViews(
        JSON.parse(localStorage.getItem("paydan.audit.views") ?? "[]"),
      );
    } catch {
      setSavedViews([]);
    }
  }, []);
  useEffect(() => {
    void load().catch((reason) => setError((reason as Error).message));
  }, [load]);
  const exportHref = useMemo(() => {
    const query = paramsFor(filters);
    query.set("format", "csv");
    return `/api/admin/audit?${query}`;
  }, [filters]);
  const saveView = () => {
    const name = window.prompt("Name this audit view");
    if (!name?.trim()) return;
    const next = [...savedViews, { name: name.trim(), filters }].slice(-12);
    setSavedViews(next);
    localStorage.setItem("paydan.audit.views", JSON.stringify(next));
  };
  return (
    <>
      <AdminPageHeader
        eyebrow="Insight"
        title="Audit trail"
        description="Filter staff, vendor, customer, webhook and worker changes and inspect recorded before/after values."
        action={
          <>
            <button
              className="admin-btn secondary"
              type="button"
              onClick={saveView}
            >
              Save view
            </button>
            <a className="admin-btn quiet" href={exportHref}>
              Stream CSV export
            </a>
          </>
        }
      />
      {savedViews.length ? (
        <div className="admin-chips" aria-label="Saved audit views">
          {savedViews.map((view, index) => (
            <button
              className="admin-chip"
              type="button"
              key={`${view.name}-${index}`}
              onClick={() => {
                setDraft(view.filters);
                setFilters(view.filters);
              }}
            >
              {view.name}
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="admin-card form-grid"
        style={{ marginTop: "1rem" }}
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(draft);
        }}
      >
        {(["action", "actor", "capability", "record"] as const).map((key) => (
          <label className="admin-field" key={key}>
            {key[0].toUpperCase() + key.slice(1)}
            <input
              className="admin-input"
              value={draft[key]}
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.value })
              }
            />
          </label>
        ))}
        <label className="admin-field">
          Source
          <select
            className="admin-select"
            value={draft.source}
            onChange={(event) =>
              setDraft({ ...draft, source: event.target.value })
            }
          >
            <option value="">All sources</option>
            {["admin", "vendor", "customer", "worker", "webhook"].map(
              (source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="admin-field">
          From
          <input
            className="admin-input"
            type="date"
            value={draft.from}
            onChange={(event) =>
              setDraft({ ...draft, from: event.target.value })
            }
          />
        </label>
        <label className="admin-field">
          To
          <input
            className="admin-input"
            type="date"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </label>
        <div className="admin-actions" style={{ alignSelf: "end" }}>
          <button className="admin-btn primary">Apply filters</button>
          <button
            className="admin-btn quiet"
            type="button"
            onClick={() => {
              setDraft(EMPTY);
              setFilters(EMPTY);
            }}
          >
            Clear
          </button>
        </div>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="admin-card" style={{ marginTop: "1rem" }}>
        {entries.map((entry) => (
          <div
            className="queue-item"
            key={entry.id}
            style={{ alignItems: "start" }}
          >
            <span>
              <strong>{entry.action}</strong>
              <br />
              {entry.record || "—"} · {entry.actor}
              {entry.capability ? ` · ${entry.capability}` : ""}
              {entry.source ? ` · ${entry.source}` : ""}
              {entry.before !== undefined || entry.after !== undefined ? (
                <>
                  <br />
                  <button
                    className="admin-btn quiet"
                    type="button"
                    aria-expanded={expanded === entry.id}
                    onClick={() =>
                      setExpanded(expanded === entry.id ? null : entry.id)
                    }
                  >
                    {expanded === entry.id ? "Hide change" : "Show change"}
                  </button>
                  {expanded === entry.id ? (
                    <div className="form-grid" style={{ marginTop: ".6rem" }}>
                      <pre className="admin-note">
                        Before{"\n"}
                        {JSON.stringify(entry.before ?? null, null, 2)}
                      </pre>
                      <pre className="admin-note">
                        After{"\n"}
                        {JSON.stringify(entry.after ?? null, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </>
              ) : null}
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
