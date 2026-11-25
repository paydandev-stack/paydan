"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
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
  const { state, refresh, actions } = useDemo();
  const [stage, setStage] = useState<string>(ALL);
  const [vendor, setVendor] = useState<string>(ALL);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStage, setBulkStage] =
    useState<ProcurementStage>("contact_vendor");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("urgent") === "true")
      setUrgentOnly(true);
  }, []);

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
  const overdue = groups.filter(({ group }) => {
    const eta = Date.parse(group.eta);
    return (
      Number.isFinite(eta) &&
      eta < Date.now() &&
      !["closed", "blocked"].includes(group.stage)
    );
  });
  const vendorWorkload = state.vendors
    .map((item) => ({
      name: item.name,
      count: groups.filter(
        ({ group }) =>
          group.vendorId === item.id &&
          !["closed", "blocked"].includes(group.stage),
      ).length,
    }))
    .filter((item) => item.count)
    .sort((a, b) => b.count - a.count);
  const assigneeWorkload = [
    ...new Set(groups.map(({ group }) => group.assignee || "Unassigned")),
  ]
    .map((name) => ({
      name,
      count: groups.filter(
        ({ group }) =>
          (group.assignee || "Unassigned") === name &&
          !["closed", "blocked"].includes(group.stage),
      ).length,
    }))
    .sort((a, b) => b.count - a.count);

  async function applyBulkStage() {
    if (!selected.length || !bulkReason.trim() || bulkBusy) return;
    setBulkBusy(true);
    try {
      await api("/api/commands", {
        name: "bulkUpdateVendorStages",
        args: [
          {
            groups: selected.map((groupId) => {
              const match = groups.find(({ group }) => group.id === groupId)!;
              return { orderId: match.order.id, groupId };
            }),
            stage: bulkStage,
            reason: bulkReason.trim(),
          },
        ],
        key: crypto.randomUUID(),
      });
      await refresh();
      setSelected([]);
      setBulkReason("");
      actions.notify("Procurement stages updated.", "success");
    } catch (error) {
      actions.notify(
        error instanceof Error ? error.message : "Could not update groups.",
        "error",
      );
    } finally {
      setBulkBusy(false);
    }
  }

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
          {
            label: "Overdue ETA",
            value: overdue.length,
            note: "Past a dated ETA and still open",
          },
        ]}
      />

      <div className="admin-panels" style={{ marginBottom: "1rem" }}>
        <section className="admin-card">
          <h3>Vendor workload</h3>
          {vendorWorkload.map((item) => (
            <div className="queue-item" key={item.name}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
          {!vendorWorkload.length ? <p>No open supplier work.</p> : null}
        </section>
        <section className="admin-card">
          <h3>Assignee workload</h3>
          {assigneeWorkload.map((item) => (
            <div className="queue-item" key={item.name}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </section>
      </div>

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
        <button
          type="button"
          className="admin-btn secondary"
          onClick={() =>
            setView((current) => (current === "table" ? "kanban" : "table"))
          }
        >
          {view === "table" ? "Kanban view" : "Table view"}
        </button>
      </div>

      {selected.length ? (
        <section className="admin-card bulk-toolbar">
          <strong>{selected.length} groups selected</strong>
          <div className="admin-actions">
            <select
              className="admin-select"
              value={bulkStage}
              onChange={(event) =>
                setBulkStage(event.target.value as ProcurementStage)
              }
            >
              {procurementStageOrder.map((value) => (
                <option key={value} value={value}>
                  {procurementStageMeta[value].label}
                </option>
              ))}
            </select>
            <input
              className="admin-input"
              value={bulkReason}
              onChange={(event) => setBulkReason(event.target.value)}
              placeholder="Required stage-change reason"
            />
            <button
              className="admin-btn primary"
              disabled={!bulkReason.trim() || bulkBusy}
              onClick={() => void applyBulkStage()}
            >
              Apply stage
            </button>
          </div>
        </section>
      ) : null}

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
      ) : view === "kanban" ? (
        <div className="admin-kanban">
          {procurementStageOrder.map((column) => (
            <section className="admin-card" key={column}>
              <h3>{procurementStageMeta[column].label}</h3>
              {visible
                .filter(({ group }) => group.stage === column)
                .map(({ order, group }) => {
                  const isLate = overdue.some(
                    ({ group: item }) => item.id === group.id,
                  );
                  return (
                    <Link
                      className="queue-item"
                      href={`/admin/procurement/${group.id}`}
                      key={group.id}
                    >
                      <span>
                        <strong>{order.reference}</strong>
                        <br />
                        {vendorName(group.vendorId)} ·{" "}
                        {group.assignee || "Unassigned"}
                      </span>
                      {isLate ? (
                        <StatusPill tone="red">Overdue</StatusPill>
                      ) : null}
                    </Link>
                  );
                })}
            </section>
          ))}
        </div>
      ) : (
        <AdminTable
          template=".3fr 1fr 1.3fr .7fr 1.3fr .9fr"
          head={["", "Order", "Vendor", "Items", "Stage", "ETA"]}
          caption={`${plural(visible.length, "vendor group")} on the board`}
        >
          {visible.map(({ order, group }) => (
            <div className="table-row" key={group.id}>
              <input
                type="checkbox"
                aria-label={`Select ${order.reference} ${vendorName(group.vendorId)}`}
                checked={selected.includes(group.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, group.id]
                      : current.filter((item) => item !== group.id),
                  )
                }
              />
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
                {overdue.some(({ group: item }) => item.id === group.id) ? (
                  <StatusPill tone="red">Overdue</StatusPill>
                ) : null}
              </span>
            </div>
          ))}
        </AdminTable>
      )}
    </>
  );
}
