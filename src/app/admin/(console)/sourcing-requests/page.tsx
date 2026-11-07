"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSearch,
  AdminTable,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDate, money, plural } from "@/lib/format";
import { sourcingStatusMeta } from "@/lib/status";
import type { SourcingStatus } from "@/lib/types";

const ALL = "all";

const statusChips: { value: string; label: string }[] = [
  { value: ALL, label: "All" },
  ...(
    Object.entries(sourcingStatusMeta) as [SourcingStatus, { label: string }][]
  ).map(([value, meta]) => ({ value, label: meta.label })),
];

/** Sourcing enquiry queue with status chips, search and KPI rollups. */
export default function AdminSourcingRequestsPage() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL);

  const sorted = [...state.sourcing].sort((a, b) =>
    a.submittedAt < b.submittedAt ? 1 : -1,
  );
  const visible = sorted.filter((request) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      needle === "" ||
      [request.reference, request.productName, request.customerName].some(
        (field) => field.toLowerCase().includes(needle),
      );
    const matchesStatus = status === ALL || request.status === status;
    return matchesQuery && matchesStatus;
  });

  const openQueue = sorted.filter(
    (request) =>
      !["converted", "cancelled", "declined"].includes(request.status),
  );
  const awaitingCustomer = sorted.filter(
    (request) => request.status === "awaiting_customer",
  );
  const quoteReady = sorted.filter(
    (request) => request.status === "quote_ready",
  );
  const converted = sorted.filter((request) => request.status === "converted");
  const rejected = sorted.filter((request) =>
    ["declined", "cancelled"].includes(request.status),
  );
  const underReview = sorted.filter((request) =>
    ["received", "under_review"].includes(request.status),
  );

  const filtersActive = query.trim() !== "" || status !== ALL;
  const clearFilters = () => {
    setQuery("");
    setStatus(ALL);
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Sourcing requests"
        description={`${plural(state.sourcing.length, "request")} on record · ${plural(
          openQueue.length,
          "request",
        )} open in the queue · secure store records`}
        action={
          <Link className="admin-btn quiet" href="/admin/procurement">
            Procurement board
          </Link>
        }
      />

      <AdminKpis
        items={[
          {
            label: "Total requests",
            value: state.sourcing.length,
            note: "On record",
          },
          {
            label: "Open queue",
            value: openQueue.length,
            note: "Still in the pipeline",
          },
          {
            label: "Awaiting customer",
            value: awaitingCustomer.length,
            note: "Quote sent, no reply yet",
          },
          {
            label: "Quotes ready",
            value: quoteReady.length,
            note: money(
              quoteReady.reduce(
                (sum, request) => sum + (request.quote?.total ?? 0),
                0,
              ),
            ),
          },
          {
            label: "Converted",
            value: converted.length,
            note: "Orders created",
          },
          {
            label: "Declined or cancelled",
            value: rejected.length,
            note: "Closed without an order",
          },
        ]}
      />

      <div className="admin-filters">
        <div
          className="admin-chips"
          role="group"
          aria-label="Filter by sourcing status"
        >
          {statusChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={`admin-chip${status === chip.value ? " active" : ""}`}
              aria-pressed={status === chip.value}
              onClick={() => setStatus(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <AdminSearch
          value={query}
          onChange={setQuery}
          label="Search sourcing requests"
          placeholder="Search reference, product or customer…"
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
            title="No sourcing requests match"
            hint="Pick another status chip or clear the search — the queue reads saved requests."
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
          template="1fr 1.3fr .9fr 1.1fr .9fr"
          head={["Request", "Product", "Customer", "Assignee", "Status"]}
          caption={`${plural(visible.length, "sourcing request")} matching the current filters`}
        >
          {visible.map((request) => (
            <div className="table-row" key={request.id}>
              <span>
                <Link
                  href={`/admin/sourcing-requests/${request.id}`}
                  style={{ color: "var(--green)", fontWeight: 700 }}
                >
                  {request.reference}
                </Link>
                <small style={{ display: "block", color: "var(--muted)" }}>
                  {formatDate(request.submittedAt, false)}
                </small>
              </span>
              <span>{request.productName}</span>
              <span>{request.customerName}</span>
              <span>{request.assignee || "Unassigned"}</span>
              <StatusPill tone={sourcingStatusMeta[request.status].tone}>
                {sourcingStatusMeta[request.status].label}
              </StatusPill>
            </div>
          ))}
        </AdminTable>
      )}
    </>
  );
}
