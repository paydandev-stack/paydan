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
import type { Customer } from "@/lib/types";
import { formatDate, plural } from "@/lib/format";

const CLOSED_FULFILMENT = ["delivered", "cancelled"];

/** Customer directory: search + segment filters, KPI strip, rows linking to detail. */
export default function AdminCustomersPage() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("all");

  const segments = [
    ...new Set(state.customers.flatMap((customer) => customer.segments)),
  ].sort((a, b) => a.localeCompare(b));

  const orderCounts = new Map<string, number>();
  const openOrderIds = new Set<string>();
  const paidOrderIds = new Set<string>();
  for (const order of state.orders) {
    orderCounts.set(
      order.customerId,
      (orderCounts.get(order.customerId) ?? 0) + 1,
    );
    if (!CLOSED_FULFILMENT.includes(order.fulfillmentStatus))
      openOrderIds.add(order.customerId);
    if (order.paymentStatus === "paid") paidOrderIds.add(order.customerId);
  }

  const hasSourcing = (customer: Customer) =>
    state.sourcing.some(
      (request) =>
        request.customerId === customer.id ||
        request.email.trim().toLowerCase() ===
          customer.email.trim().toLowerCase(),
    );

  const sourcingCount = state.customers.filter(hasSourcing).length;
  const joinedRecently = state.customers.filter(
    (customer) =>
      new Date(customer.joinedAt).getTime() >
      Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length;

  const filtered = state.customers.filter((customer) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      needle.length === 0 ||
      [customer.name, customer.email, customer.phone].some((value) =>
        value.toLowerCase().includes(needle),
      );
    const matchesSegment =
      segment === "all" || customer.segments.includes(segment);
    return matchesQuery && matchesSegment;
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Customers"
        title="Customers"
        description={`${plural(
          state.customers.length,
          "profile",
        )} in the store · ${plural(segments.length, "segment")} in use · search matches name, email and phone`}
        action={
          <Link className="admin-btn" href="/admin/analytics">
            Growth analytics
          </Link>
        }
      />

      <AdminKpis
        items={[
          {
            label: "Total customers",
            value: state.customers.length,
            note: `${plural(filtered.length, "profile")} in the current view`,
          },
          {
            label: "Joined in the last 30 days",
            value: joinedRecently,
            note: "joinedAt within 30 days of today",
          },
          {
            label: "With an open order",
            value: state.customers.filter((customer) =>
              openOrderIds.has(customer.id),
            ).length,
            note: "Orders not yet delivered or cancelled",
          },
          {
            label: "With sourcing activity",
            value: sourcingCount,
            note: "Matched on customer id or email",
          },
          {
            label: "With paid orders",
            value: state.customers.filter((customer) =>
              paidOrderIds.has(customer.id),
            ).length,
            note: "At least one order marked paid",
          },
          {
            label: "Segments in use",
            value: segments.length,
            note: "Distinct labels across profiles",
          },
        ]}
      />

      <div className="admin-filters">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search name, email or phone…"
          label="Search customers by name, email or phone"
        />
        <AdminSelect
          label="Segment"
          value={segment}
          onChange={setSegment}
          options={[
            { value: "all", label: "All segments" },
            ...segments.map((item) => ({ value: item, label: item })),
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <AdminEmpty
          title="No customers match"
          hint="Nothing in the store matches this search and segment combination. Clear the filters to see every profile."
        />
      ) : (
        <AdminTable
          template=".9fr 1.2fr .8fr 1.1fr .8fr"
          head={["Customer", "Location", "Segment", "Joined", "Orders"]}
          caption="Customers matching the current filters; each row opens the profile"
        >
          {filtered.map((customer) => (
            <Link
              className="table-row"
              key={customer.id}
              href={`/admin/customers/${customer.id}`}
            >
              <span>
                <strong style={{ color: "var(--green)" }}>
                  {customer.name}
                </strong>
                <br />
                <small style={{ color: "var(--muted)" }}>
                  {customer.email}
                </small>
              </span>
              <span>
                {customer.city}, {customer.state}
              </span>
              <span className="admin-chips">
                {customer.segments.map((item) => (
                  <span className="admin-chip" key={item}>
                    {item}
                  </span>
                ))}
              </span>
              <span style={{ color: "var(--muted)" }}>
                {formatDate(customer.joinedAt)}
              </span>
              <span style={{ textAlign: "right" }}>
                {orderCounts.get(customer.id) ?? 0}
              </span>
            </Link>
          ))}
        </AdminTable>
      )}
    </>
  );
}
