"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSelect,
  AdminTable,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDate, plural } from "@/lib/format";
import { procurementStageMeta, procurementStageOrder } from "@/lib/status";
import type { ProcurementStage } from "@/lib/types";

const ALL = "all";

const stageFilterOptions = [
  { value: ALL, label: "Any stage" },
  ...procurementStageOrder.map((stage) => ({
    value: stage,
    label: procurementStageMeta[stage].label,
  })),
];

/** Flattened board of every vendor group across all orders. */
export default function AdminProcurementPage() {
  const { state } = useDemo();
  const [stage, setStage] = useState<string>(ALL);
  const [vendor, setVendor] = useState<string>(ALL);
  const [urgentOnly, setUrgentOnly] = useState(false);

  const groups = state.orders.flatMap((order) =>
    order.vendorGroups.map((group) => ({ order, group })),
  );
  const vendorName = (vendorId: string) =>
    state.vendors.find((item) => item.id === vendorId)?.name ?? vendorId;
  const vendorCity = (vendorId: string) =>
    state.vendors.find((item) => item.id === vendorId)?.city ?? "";

  const visible = groups
    .filter(({ group }) => stage === ALL || group.stage === stage)
    .filter(({ group }) => vendor === ALL || group.vendorId === vendor)
    .filter(({ group }) => !urgentOnly || group.urgent)
    .sort((a, b) => (a.group.updatedAt < b.group.updatedAt ? 1 : -1));

  const blocked = groups.filter(({ group }) => group.stage === "blocked");
  const urgent = groups.filter(({ group }) => group.urgent);
  const awaitingAssignment = groups.filter(
    ({ group }) => group.stage === "awaiting_assignment",
  );
  const inMotion = groups.filter(
    ({ group }) =>
      !["awaiting_assignment", "blocked", "closed"].includes(group.stage),
  );
  const closed = groups.filter(({ group }) => group.stage === "closed");

  const filtersActive = stage !== ALL || vendor !== ALL || urgentOnly;
  const clearFilters = () => {
    setStage(ALL);
    setVendor(ALL);
    setUrgentOnly(false);
  };

  const vendorFilterOptions = [
    { value: ALL, label: "All vendors" },
    ...state.vendors.map((item) => ({ value: item.id, label: item.name })),
  ];

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Procurement board"
        description={`${plural(groups.length, "vendor group")} across ${plural(
          state.orders.length,
          "order",
        )} · ${blocked.length} blocked · ${urgent.length} urgent`}
        action={
          <Link className="admin-btn quiet" href="/admin/orders">
            Orders
          </Link>
        }
      />

      <AdminKpis
        items={[
          {
            label: "Vendor groups",
            value: groups.length,
            note: `${state.orders.length} parent orders`,
          },
          {
            label: "Blocked",
            value: blocked.length,
            note: "Stalled or cancelled work",
          },
          { label: "Urgent", value: urgent.length, note: "Flagged expedited" },
          {
            label: "Awaiting assignment",
            value: awaitingAssignment.length,
            note: "No stage movement yet",
          },
          {
            label: "In motion",
            value: inMotion.length,
            note: "Contact vendor through dispatch",
          },
          {
            label: "Closed",
            value: closed.length,
            note: "Supplier work complete",
          },
        ]}
      />

      <div className="admin-filters">
        <AdminSelect
          label="Filter by procurement stage"
          value={stage}
          onChange={setStage}
          options={stageFilterOptions}
        />
        <AdminSelect
          label="Filter by vendor"
          value={vendor}
          onChange={setVendor}
          options={vendorFilterOptions}
        />
        <button
          type="button"
          className={`admin-chip${urgentOnly ? " active" : ""}`}
          aria-pressed={urgentOnly}
          onClick={() => setUrgentOnly((current) => !current)}
        >
          Urgent only
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

      {visible.length === 0 ? (
        <>
          <AdminEmpty
            title="No vendor groups match these filters"
            hint="Try another stage, vendor or clear the urgent-only toggle — the board reads live order data."
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
          template="1fr 1.3fr .7fr 1.3fr .9fr"
          head={["Order", "Vendor", "Items", "Stage", "ETA"]}
          caption={`${plural(visible.length, "vendor group")} on the board`}
        >
          {visible.map(({ order, group }) => (
            <div className="table-row" key={group.id}>
              <span>
                <Link
                  href={`/admin/orders/${order.id}`}
                  style={{ color: "var(--green)", fontWeight: 700 }}
                >
                  {order.reference}
                </Link>
                <small style={{ display: "block", color: "var(--muted)" }}>
                  {order.customerName}
                </small>
              </span>
              <span>
                <Link
                  href={`/admin/procurement/${group.id}`}
                  style={{ color: "var(--green)", fontWeight: 700 }}
                >
                  {vendorName(group.vendorId)}
                </Link>
                <small style={{ display: "block", color: "var(--muted)" }}>
                  {vendorCity(group.vendorId)}
                </small>
              </span>
              <span>{plural(group.items.length, "item")}</span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: ".3rem",
                  alignItems: "flex-start",
                }}
              >
                <StatusPill tone={procurementStageMeta[group.stage].tone}>
                  {procurementStageMeta[group.stage].label}
                </StatusPill>
                {group.urgent ? (
                  <StatusPill tone="red">Urgent</StatusPill>
                ) : null}
              </span>
              <span style={{ color: "var(--muted)" }}>
                {formatDate(group.eta)}
              </span>
            </div>
          ))}
        </AdminTable>
      )}
    </>
  );
}
