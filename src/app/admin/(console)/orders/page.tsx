"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSearch,
  AdminSelect,
  AdminTable,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDate, money, plural } from "@/lib/format";
import { fulfillmentStatusMeta, paymentStatusMeta } from "@/lib/status";

const ALL = "all";

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

/** Every recorded order, filterable by reference, customer, payment and fulfilment. */
export default function AdminOrdersPage() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState(ALL);
  const [fulfilment, setFulfilment] = useState(ALL);

  const sorted = [...state.orders].sort((a, b) =>
    a.placedAt < b.placedAt ? 1 : -1,
  );
  const visible = sorted.filter((order) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      needle === "" ||
      [order.reference, order.customerName, order.customerEmail].some((field) =>
        field.toLowerCase().includes(needle),
      );
    const matchesPayment = payment === ALL || order.paymentStatus === payment;
    const matchesFulfilment =
      fulfilment === ALL || order.fulfillmentStatus === fulfilment;
    return matchesQuery && matchesPayment && matchesFulfilment;
  });

  const awaitingPayment = sorted.filter(
    (order) => order.paymentStatus === "pending",
  );
  const openOrders = sorted.filter(
    (order) => !["delivered", "cancelled"].includes(order.fulfillmentStatus),
  );
  const paidOrders = sorted.filter((order) => order.paymentStatus === "paid");
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const delivered = sorted.filter(
    (order) => order.fulfillmentStatus === "delivered",
  );
  const cancelled = sorted.filter(
    (order) => order.fulfillmentStatus === "cancelled",
  );
  const refunded = sorted.filter((order) => order.paymentStatus === "refunded");

  const filtersActive =
    query.trim() !== "" || payment !== ALL || fulfilment !== ALL;
  const clearFilters = () => {
    setQuery("");
    setPayment(ALL);
    setFulfilment(ALL);
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Orders"
        description={`${plural(state.orders.length, "order")} on record · ${plural(
          openOrders.length,
          "order",
        )} still open · secure store records`}
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
            note: `${openOrders.length} still open`,
          },
          {
            label: "Awaiting payment",
            value: awaitingPayment.length,
            note: money(
              awaitingPayment.reduce((sum, order) => sum + order.total, 0),
            ),
          },
          {
            label: "Open orders",
            value: openOrders.length,
            note: "Not delivered or cancelled",
          },
          {
            label: "Paid revenue",
            value: money(paidRevenue),
            note: plural(paidOrders.length, "paid order"),
          },
          {
            label: "Delivered",
            value: delivered.length,
            note: "Fulfilment complete",
          },
          {
            label: "Cancelled",
            value: cancelled.length,
            note: `${refunded.length} refunded`,
          },
        ]}
      />

      <div className="admin-filters">
        <AdminSearch
          value={query}
          onChange={setQuery}
          label="Search orders by reference, customer or email"
          placeholder="Search reference, customer or email…"
        />
        <AdminSelect
          label="Filter by payment status"
          value={payment}
          onChange={setPayment}
          options={paymentFilterOptions}
        />
        <AdminSelect
          label="Filter by fulfilment status"
          value={fulfilment}
          onChange={setFulfilment}
          options={fulfilmentFilterOptions}
        />
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

      {visible.length === 0 ? (
        <>
          <AdminEmpty
            title="No orders match these filters"
            hint="Adjust the search, payment or fulfilment filters — the table reads from the store orders."
          />
          {filtersActive ? (
            <div
              className="admin-actions"
              style={{ justifyContent: "center", marginTop: "1rem" }}
            >
              <button
                type="button"
                className="admin-btn quiet"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <AdminTable
          template="1fr 1.4fr .9fr 1.3fr .9fr"
          head={["Order", "Customer", "Payment", "Fulfilment", "Total"]}
          caption={`${plural(visible.length, "order")} matching the current filters`}
        >
          {visible.map((order) => (
            <div className="table-row" key={order.id}>
              <span>
                <Link
                  href={`/admin/orders/${order.id}`}
                  style={{ color: "var(--green)", fontWeight: 700 }}
                >
                  {order.reference}
                </Link>
                <small style={{ display: "block", color: "var(--muted)" }}>
                  {formatDate(order.placedAt, false)}
                </small>
              </span>
              <span>{order.customerName}</span>
              <StatusPill tone={paymentStatusMeta[order.paymentStatus].tone}>
                {paymentStatusMeta[order.paymentStatus].label}
              </StatusPill>
              <StatusPill
                tone={fulfillmentStatusMeta[order.fulfillmentStatus].tone}
              >
                {fulfillmentStatusMeta[order.fulfillmentStatus].label}
              </StatusPill>
              <span style={{ textAlign: "right" }}>{money(order.total)}</span>
            </div>
          ))}
        </AdminTable>
      )}
    </>
  );
}
