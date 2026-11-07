import type { Money } from "./types";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

export function money(amount: Money): string {
  return naira.format(amount);
}

export function compactMoney(amount: Money): string {
  return new Intl.NumberFormat("en-NG", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("·", "")
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatDate(value: string, withYear = true): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function daysAgo(value: string, now = new Date()): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const diff = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function ageLabel(value: string): string {
  const days = daysAgo(value);
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function percentOff(price: Money, compareAt?: Money): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function orderReference(): string {
  const serial = Math.floor(1000 + Math.random() * 8999);
  return `PD-2026-${serial}`;
}

export function requestReference(): string {
  const serial = Math.floor(100 + Math.random() * 899);
  return `SR-2026-${serial}`;
}

export function quoteReference(): string {
  const serial = Math.floor(100 + Math.random() * 899);
  return `QT-2026-${serial}`;
}

export function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}
