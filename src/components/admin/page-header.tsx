"use client";

import type { ReactNode } from "react";

/**
 * Eyebrow + serif title + optional supporting copy, matching the
 * `.admin-content > header` rules in admin.css.
 */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header>
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {action ? <div className="admin-actions">{action}</div> : null}
    </header>
  );
}

export type Kpi = { label: string; value: string | number; note?: string };

/** Six-up KPI strip used across the dashboard and analytics. */
export function AdminKpis({ items }: { items: Kpi[] }) {
  return (
    <div className="admin-kpis">
      {items.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note ? <small>{item.note}</small> : null}
        </article>
      ))}
    </div>
  );
}
