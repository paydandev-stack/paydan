"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

export function AdminField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const hintId = useId();
  const errorId = useId();
  return (
    <label className="admin-field">
      <span className="admin-field-label">
        {label}
        {required ? <em aria-hidden="true"> *</em> : null}
      </span>
      {children}
      {hint ? (
        <small className="admin-field-hint" id={hintId}>
          {hint}
        </small>
      ) : null}
      {error ? (
        <small className="admin-field-error" id={errorId} role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
}

export function FilterBar({
  children,
  onReset,
}: {
  children: ReactNode;
  onReset?: () => void;
}) {
  return (
    <form
      className="admin-filter-bar"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="admin-filter-fields">{children}</div>
      {onReset ? (
        <button className="admin-btn quiet" type="button" onClick={onReset}>
          Reset
        </button>
      ) : null}
    </form>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="admin-dialog-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="admin-dialog-actions">
          <button
            className="admin-btn secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="admin-btn danger"
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaginationControls({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <button
        className="admin-btn quiet"
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        className="admin-btn quiet"
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function StatusBadge({
  value,
  tone = "neutral",
}: {
  value: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  return <span className={"admin-status-badge tone-" + tone}>{value}</span>;
}

export function SlaBadge({
  dueAt,
  label = "SLA",
}: {
  dueAt?: string;
  label?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!dueAt || now === null)
    return <span className="admin-sla unknown">No due date</span>;
  const remaining = Date.parse(dueAt) - now;
  const hours = Math.round(Math.abs(remaining) / 3_600_000);
  const text =
    remaining < 0
      ? hours < 24
        ? "Overdue " + hours + "h"
        : "Overdue " + Math.round(hours / 24) + "d"
      : hours < 24
        ? hours + "h left"
        : Math.round(hours / 24) + "d left";
  return (
    <span className={"admin-sla " + (remaining < 0 ? "late" : "ok")}>
      {label}: {text}
    </span>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-card admin-section-card">
      <header className="admin-section-card-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
