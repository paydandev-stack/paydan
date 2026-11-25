"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { downloadCsv } from "@/lib/csv";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSearch,
  AdminSelect,
  AdminTable,
} from "@/components/admin/data-table";
import { ConfirmDialog, SlaBadge } from "@/components/admin/admin-controls";
import { StatusPill } from "@/components/status-pill";
import { formatDate, money, plural } from "@/lib/format";
import { fulfillmentStatusMeta, paymentStatusMeta } from "@/lib/status";
import type { Order } from "@/lib/types";

const ALL = "all";
const DAY = 86_400_000;
const SLA_DAYS = 5;

const paymentFilterOptions = [
  { value: ALL, label: "Any payment state" },
  ...Object.entries(paymentStatusMeta).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

const fulfilmentFilterOptions = [
  { value: ALL, label: "Any fulfilment state" },
  ...Object.entries(fulfillmentStatusMeta).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

function dueAt(order: Order) {
  return new Date(Date.parse(order.placedAt) + SLA_DAYS * DAY).toISOString();
}

function vendorsFor(order: Order) {
  return [...new Set(order.vendorGroups.map((group) => group.vendorId))];
}

/** Every recorded order, filterable by reference, customer, payment and fulfilment. */
export default function AdminOrdersPage() {
  const { state, refresh } = useDemo();
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState(ALL);
  const [fulfilment, setFulfilment] = useState(ALL);
  const [method, setMethod] = useState(ALL);
  const [vendor, setVendor] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"date" | "total" | "age">("date");
  const [descending, setDescending] = useState(true);
  const [visibleCount, setVisibleCount] = useState(50);
  const [selected, setSelected] = useState<string[]>([]);
  const [tracking, setTracking] = useState("");
  const [confirmShip, setConfirmShip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(
    () => setVisibleCount(50),
    [query, payment, fulfilment, method, vendor, from, to, sort, descending],
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentParam = params.get("payment");
    const fulfilmentParam = params.get("fulfilment");
    if (paymentParam) setPayment(paymentParam);
    if (fulfilmentParam) setFulfilment(fulfilmentParam);
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const toTime = to
      ? Date.parse(to + "T23:59:59.999Z")
      : Number.POSITIVE_INFINITY;
    const fromTime = from
      ? Date.parse(from + "T00:00:00.000Z")
      : Number.NEGATIVE_INFINITY;
    const filtered = state.orders.filter((order) => {
      const placed = Date.parse(order.placedAt);
      if (placed < fromTime || placed > toTime) return false;
      if (payment !== ALL && order.paymentStatus !== payment) return false;
      if (fulfilment !== ALL && order.fulfillmentStatus !== fulfilment)
        return false;
      if (method !== ALL && order.paymentMethod !== method) return false;
      if (vendor !== ALL && !vendorsFor(order).includes(vendor)) return false;
      if (!needle) return true;
      return [
        order.reference,
        order.customerName,
        order.customerEmail,
        order.trackingCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered.sort((a, b) => {
      let result = 0;
      if (sort === "total") result = a.total - b.total;
      else if (sort === "age")
        result = Date.parse(a.placedAt) - Date.parse(b.placedAt);
      else result = a.reference.localeCompare(b.reference);
      return descending ? -result : result;
    });
  }, [
    state.orders,
    query,
    payment,
    fulfilment,
    method,
    vendor,
    from,
    to,
    sort,
    descending,
  ]);

  const visibleOrders = visible.slice(0, visibleCount);
  const openOrders = state.orders.filter(
    (order) => !["delivered", "cancelled"].includes(order.fulfillmentStatus),
  );
  const awaitingPayment = state.orders.filter(
    (order) => order.paymentStatus === "pending",
  );
  const paidRevenue = state.orders
    .filter((order) => order.paymentStatus === "paid")
    .reduce((sum, order) => sum + order.total, 0);
  const overdue = openOrders.filter(
    (order) => Date.now() > Date.parse(dueAt(order)),
  );
  const filtersActive =
    query.trim() !== "" ||
    payment !== ALL ||
    fulfilment !== ALL ||
    method !== ALL ||
    vendor !== ALL ||
    Boolean(from) ||
    Boolean(to);
  const clearFilters = () => {
    setQuery("");
    setPayment(ALL);
    setFulfilment(ALL);
    setMethod(ALL);
    setVendor(ALL);
    setFrom("");
    setTo("");
  };

  function exportOrders() {
    downloadCsv("paydan-orders.csv", [
      [
        "reference",
        "placedAt",
        "customer",
        "email",
        "paymentStatus",
        "fulfillmentStatus",
        "paymentMethod",
        "vendors",
        "total",
        "trackingCode",
        "slaDueAt",
      ],
      ...visible.map((order) => [
        order.reference,
        order.placedAt,
        order.customerName,
        order.customerEmail,
        order.paymentStatus,
        order.fulfillmentStatus,
        order.paymentMethod,
        vendorsFor(order).join(" | "),
        String(order.total),
        order.trackingCode,
        dueAt(order),
      ]),
    ]);
  }

  async function shipSelected() {
    const valid = selected.filter((id) => {
      const order = state.orders.find((item) => item.id === id);
      return (
        order?.paymentStatus === "paid" &&
        ["processing", "sourcing", "partially_packed", "dispatched"].includes(
          order.fulfillmentStatus,
        )
      );
    });
    if (!valid.length) {
      setMessage("Select paid orders that can be dispatched.");
      setConfirmShip(false);
      return;
    }
    setBusy(true);
    try {
      await api("/api/commands", {
        name: "bulkShipOrders",
        args: [{ ids: valid, trackingCode: tracking.trim() }],
        key: crypto.randomUUID(),
      });
      await refresh();
      setMessage("Dispatched " + plural(valid.length, "order") + ".");
      setSelected([]);
      setTracking("");
      setConfirmShip(false);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function sortButton(label: string, next: typeof sort) {
    return (
      <button
        type="button"
        className="admin-attention-link"
        onClick={() => {
          if (sort === next) setDescending((current) => !current);
          else {
            setSort(next);
            setDescending(true);
          }
        }}
      >
        {label} {sort === next ? (descending ? "↓" : "↑") : ""}
      </button>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Orders"
        description={
          state.orders.length +
          " orders on record · " +
          openOrders.length +
          " still open · secure store records"
        }
        action={
          <Link className="admin-btn quiet" href="/admin/procurement">
            Procurement board
          </Link>
        }
      />

      <AdminKpis
        items={[
          {
            label: "Total orders",
            value: state.orders.length,
            note: openOrders.length + " still open",
          },
          {
            label: "Awaiting payment",
            value: awaitingPayment.length,
            note: money(
              awaitingPayment.reduce((sum, order) => sum + order.total, 0),
            ),
          },
          {
            label: "Paid revenue",
            value: money(paidRevenue),
            note: "Verified payments only",
          },
          {
            label: "Past fulfilment SLA",
            value: overdue.length,
            note: "Open longer than " + SLA_DAYS + " days",
          },
        ]}
      />

      <div className="admin-filters">
        <AdminSearch
          value={query}
          onChange={setQuery}
          label="Search orders by reference, customer, email or tracking"
          placeholder="Search reference, customer or tracking…"
        />
        <AdminSelect
          label="Payment status"
          value={payment}
          onChange={setPayment}
          options={paymentFilterOptions}
        />
        <AdminSelect
          label="Fulfilment state"
          value={fulfilment}
          onChange={setFulfilment}
          options={fulfilmentFilterOptions}
        />
        <AdminSelect
          label="Payment method"
          value={method}
          onChange={setMethod}
          options={[
            { value: ALL, label: "Any payment method" },
            { value: "paystack", label: "Paystack" },
            { value: "transfer", label: "Bank transfer" },
          ]}
        />
        <AdminSelect
          label="Supplier"
          value={vendor}
          onChange={setVendor}
          options={[
            { value: ALL, label: "Any supplier" },
            ...state.vendors.map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
        />
        <label className="admin-field">
          From
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="admin-field">
          To
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button
          className="admin-btn quiet"
          type="button"
          onClick={exportOrders}
        >
          Export CSV
        </button>
        {filtersActive ? (
          <button
            type="button"
            className="admin-btn quiet"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <section className="admin-card">
        <div className="admin-actions">
          <strong>{selected.length} selected</strong>
          <input
            className="admin-input"
            aria-label="Tracking code for selected orders"
            value={tracking}
            maxLength={150}
            placeholder="Tracking code or waybill"
            onChange={(event) => setTracking(event.target.value)}
          />
          <button
            className="admin-btn"
            type="button"
            disabled={!selected.length || tracking.trim().length < 3}
            onClick={() => setConfirmShip(true)}
          >
            Mark selected as dispatched
          </button>
        </div>
        {message ? <p role="status">{message}</p> : null}
      </section>

      <ConfirmDialog
        open={confirmShip}
        title="Dispatch selected orders?"
        description={
          selected.length +
          " orders will move to dispatched with tracking “" +
          tracking.trim() +
          "”. Customers receive a status notification."
        }
        confirmLabel="Dispatch orders"
        busy={busy}
        onConfirm={() => void shipSelected()}
        onClose={() => setConfirmShip(false)}
      />

      {visible.length === 0 ? (
        <AdminEmpty
          title="No orders match these filters"
          hint="Adjust the search, status, supplier or date filters."
        />
      ) : (
        <AdminTable
          template="2.2fr 1.4fr 1.1fr 1.2fr .9fr 1.1fr"
          head={[
            "",
            sortButton("Order", "date"),
            "Customer",
            "Payment",
            "Fulfilment / SLA",
            sortButton("Total", "total"),
          ]}
          caption={visible.length + " orders matching the current filters"}
        >
          {visibleOrders.map((order) => {
            const shipped = ["dispatched", "delivered"].includes(
              order.fulfillmentStatus,
            );
            return (
              <div className="table-row" key={order.id}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={"Select " + order.reference}
                    checked={selected.includes(order.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, order.id]
                          : current.filter((id) => id !== order.id),
                      )
                    }
                  />
                </label>
                <span>
                  <Link
                    href={"/admin/orders/" + order.id}
                    style={{ color: "var(--green)", fontWeight: 700 }}
                  >
                    {order.reference}
                  </Link>
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    {formatDate(order.placedAt, false)} · {order.paymentMethod}
                  </small>
                  {order.trackingCode && shipped ? (
                    <small style={{ display: "block", color: "var(--muted)" }}>
                      Tracking {order.trackingCode}
                    </small>
                  ) : null}
                </span>
                <span>{order.customerName}</span>
                <StatusPill tone={paymentStatusMeta[order.paymentStatus].tone}>
                  {paymentStatusMeta[order.paymentStatus].label}
                </StatusPill>
                <span>
                  <StatusPill
                    tone={fulfillmentStatusMeta[order.fulfillmentStatus].tone}
                  >
                    {fulfillmentStatusMeta[order.fulfillmentStatus].label}
                  </StatusPill>
                  <SlaBadge
                    dueAt={dueAt(order)}
                    label={
                      ["delivered", "cancelled"].includes(
                        order.fulfillmentStatus,
                      )
                        ? "Closed"
                        : "Dispatch"
                    }
                  />
                </span>
                <span style={{ textAlign: "right" }}>{money(order.total)}</span>
              </div>
            );
          })}
        </AdminTable>
      )}
      {visibleOrders.length < visible.length ? (
        <div className="admin-actions" style={{ justifyContent: "center" }}>
          <button
            className="admin-btn quiet"
            type="button"
            onClick={() => setVisibleCount((count) => count + 50)}
          >
            Load 50 more orders
          </button>
        </div>
      ) : null}
    </>
  );
}
