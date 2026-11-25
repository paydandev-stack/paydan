"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
import { MediaUpload } from "@/components/media-upload";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTable, AdminTextArea } from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDate, formatDateTime, money, plural } from "@/lib/format";
import {
  procurementStageMeta,
  procurementStageOrder,
  vendorStatusMeta,
} from "@/lib/status";
import { vendorGroupCost, vendorGroupTotal } from "@/lib/order-math";
/**
 * One vendor sub-order: stage control, operator notes, group economics and
 * the supplier profile behind it. The `id` route segment is a VendorSubOrder id.
 */
export default function AdminProcurementGroupPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions, refresh } = useDemo();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const match = state.orders
    .flatMap((order) => order.vendorGroups.map((group) => ({ order, group })))
    .find((entry) => entry.group.id === id);
  const [noteDraft, setNoteDraft] = useState(match?.group.notes ?? "");
  const [assigneeDraft, setAssigneeDraft] = useState(
    match?.group.assignee ?? "",
  );
  const [etaDraft, setEtaDraft] = useState(match?.group.eta ?? "");
  const [poDraft, setPoDraft] = useState(match?.group.purchaseOrderRef ?? "");
  const [reasonDraft, setReasonDraft] = useState(
    match?.group.stageReason ?? "",
  );
  const [evidence, setEvidence] = useState<string[]>(
    match?.group.evidenceUrls ?? [],
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNoteDraft(match?.group.notes ?? "");
    setAssigneeDraft(match?.group.assignee ?? "");
    setEtaDraft(match?.group.eta ?? "");
    setPoDraft(match?.group.purchaseOrderRef ?? "");
    setReasonDraft(match?.group.stageReason ?? "");
    setEvidence(match?.group.evidenceUrls ?? []);
    // Reset the editor when a different vendor group is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.group.id]);
  if (!match) notFound();
  const { order, group } = match;
  const vendor = state.vendors.find((item) => item.id === group.vendorId);
  const groupValue = vendorGroupTotal(group);
  const groupCost = vendorGroupCost(group);
  const groupMargin = groupValue - groupCost;
  const marginPct =
    groupValue > 0 ? Math.round((groupMargin / groupValue) * 100) : 0;
  const saveDetails = async (stage = group.stage) => {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/commands", {
        name: "updateVendorStage",
        args: [
          order.id,
          group.id,
          stage,
          {
            notes: noteDraft,
            assignee: assigneeDraft,
            eta: etaDraft,
            purchaseOrderRef: poDraft,
            evidenceUrls: evidence,
            stageReason: reasonDraft,
          },
        ],
        key: crypto.randomUUID(),
      });
      await refresh();
      actions.notify("Procurement details saved", "success");
    } catch (error) {
      actions.notify(
        error instanceof Error
          ? error.message
          : "Could not save procurement details.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AdminPageHeader
        eyebrow="Procurement"
        title={vendor?.name ?? "Vendor group"}
        description={`${order.reference} · ${procurementStageMeta[group.stage].label} · updated ${formatDateTime(group.updatedAt)}`}
        action={
          <>
            <Link
              className="admin-btn ghost"
              href={`/admin/orders/${order.id}`}
            >
              Order {order.reference}
            </Link>
            <Link className="admin-btn quiet" href="/admin/procurement">
              Procurement board
            </Link>
          </>
        }
      />

      <div className="admin-detail">
        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="admin-card">
            <h3>Stage</h3>
            <div
              className="admin-chips"
              role="group"
              aria-label="Procurement stage"
            >
              {procurementStageOrder.map((stage) => {
                const active = group.stage === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    className={`admin-chip${active ? " active" : ""}`}
                    aria-pressed={active}
                    disabled={active}
                    onClick={() => void saveDetails(stage)}
                  >
                    {procurementStageMeta[stage].label}
                  </button>
                );
              })}
            </div>
            <p style={{ marginTop: ".8rem" }}>
              Moving the stage records an audit entry and stamps the group. The
              current stage is{" "}
              <strong>{procurementStageMeta[group.stage].label}</strong>
              {procurementStageMeta[group.stage].hint
                ? ` — ${procurementStageMeta[group.stage].hint}`
                : ""}
              .
            </p>

            <div style={{ marginTop: "1rem" }}>
              <AdminTextArea
                label="Group notes"
                wide
                hint="Internal operator notes for this supplier group; persisted through the stage action."
                rows={4}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
              />
              <div className="form-grid" style={{ marginTop: ".8rem" }}>
                <label className="admin-field">
                  Assignee
                  <select
                    className="admin-select"
                    value={assigneeDraft}
                    onChange={(event) => setAssigneeDraft(event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {state.team
                      .filter(
                        (member) =>
                          member.role !== "Vendor" &&
                          member.status === "active",
                      )
                      .map((member) => (
                        <option key={member.id} value={member.name}>
                          {member.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="admin-field">
                  ETA
                  <input
                    className="admin-input"
                    type="date"
                    value={
                      /^\d{4}-\d{2}-\d{2}/.test(etaDraft)
                        ? etaDraft.slice(0, 10)
                        : ""
                    }
                    onChange={(event) => setEtaDraft(event.target.value)}
                  />
                </label>
                <label className="admin-field">
                  Purchase-order reference
                  <input
                    className="admin-input"
                    value={poDraft}
                    onChange={(event) => setPoDraft(event.target.value)}
                  />
                </label>
                <label className="admin-field">
                  Stage-change reason
                  <input
                    className="admin-input"
                    value={reasonDraft}
                    onChange={(event) => setReasonDraft(event.target.value)}
                    placeholder="Why this group moved or is blocked"
                  />
                </label>
              </div>
              <MediaUpload
                purpose="sourcing"
                title="Delivery evidence"
                images={evidence}
                maxFiles={20}
                onUploaded={(url) =>
                  setEvidence((current) => [...current, url])
                }
                onRemove={(url) =>
                  setEvidence((current) =>
                    current.filter((item) => item !== url),
                  )
                }
              />
              <div
                className="admin-actions"
                style={{ marginTop: ".7rem", justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  className="admin-btn primary"
                  disabled={busy}
                  onClick={() => void saveDetails()}
                >
                  {busy ? "Saving…" : "Save procurement details"}
                </button>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <h3>Group items</h3>
            <AdminTable
              template="1.5fr .5fr .8fr .8fr .9fr"
              head={["Item", "Qty", "Unit price", "Cost", "Line margin"]}
              caption={`The ${plural(group.items.length, "item")} in this vendor group`}
            >
              {group.items.map((item, index) => {
                const lineRevenue = item.unitPrice * item.quantity;
                const lineMargin =
                  (item.unitPrice - item.costPrice) * item.quantity;
                const linePct =
                  lineRevenue > 0
                    ? Math.round((lineMargin / lineRevenue) * 100)
                    : 0;
                return (
                  <div
                    className="table-row"
                    key={`${item.productId}-${item.variantLabel}-${index}`}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small
                        style={{ display: "block", color: "var(--muted)" }}
                      >
                        {item.variantLabel}
                      </small>
                    </span>
                    <span>{item.quantity}</span>
                    <span style={{ textAlign: "right" }}>
                      {money(item.unitPrice)}
                    </span>
                    <span style={{ textAlign: "right", color: "var(--muted)" }}>
                      {money(item.costPrice)}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {money(lineMargin)}
                      <small
                        style={{ display: "block", color: "var(--muted)" }}
                      >
                        {linePct}%
                      </small>
                    </span>
                  </div>
                );
              })}
            </AdminTable>
            <div className="admin-meta" style={{ marginTop: "1rem" }}>
              <div>
                <span>Group value</span>
                <strong>{money(groupValue)}</strong>
              </div>
              <div>
                <span>Group cost (internal)</span>
                <strong>{money(groupCost)}</strong>
              </div>
              <div>
                <span>Group margin</span>
                <strong>
                  {money(groupMargin)} · {marginPct}%
                </strong>
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="admin-card">
            <h3>Order</h3>
            <div className="admin-meta">
              <div>
                <span>Reference</span>
                <strong>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    style={{ color: "var(--green)" }}
                  >
                    {order.reference}
                  </Link>
                </strong>
              </div>
              <div>
                <span>Customer</span>
                <strong>{order.customerName}</strong>
              </div>
              <div>
                <span>Placed</span>
                <strong>{formatDate(order.placedAt)}</strong>
              </div>
              <div>
                <span>Order total</span>
                <strong>{money(order.total)}</strong>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <h3>Group details</h3>
            <div className="admin-meta">
              <div>
                <span>Stage</span>
                <strong>
                  <StatusPill tone={procurementStageMeta[group.stage].tone}>
                    {procurementStageMeta[group.stage].label}
                  </StatusPill>
                </strong>
              </div>
              <div>
                <span>Assignee</span>
                <strong>{group.assignee || "Unassigned"}</strong>
              </div>
              <div>
                <span>ETA</span>
                <strong>{formatDate(group.eta)}</strong>
              </div>
              <div>
                <span>Urgent</span>
                <strong>{group.urgent ? "Yes — expedited" : "No"}</strong>
              </div>
              <div>
                <span>Last updated</span>
                <strong>{formatDateTime(group.updatedAt)}</strong>
              </div>
            </div>
            {!vendor ? (
              <p style={{ marginTop: ".8rem" }}>
                The vendor record for this group is no longer in the directory;
                stage and notes still work.
              </p>
            ) : null}
          </section>

          {vendor ? (
            <section className="admin-card">
              <h3>Vendor profile</h3>
              <div className="admin-meta">
                <div>
                  <span>Contact</span>
                  <strong>{vendor.contactName}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{vendor.email}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{vendor.phone}</strong>
                </div>
                <div>
                  <span>Location</span>
                  <strong>
                    {vendor.city}, {vendor.state}
                  </strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>
                    <StatusPill tone={vendorStatusMeta[vendor.status].tone}>
                      {vendorStatusMeta[vendor.status].label}
                    </StatusPill>
                  </strong>
                </div>
                <div>
                  <span>Lead time</span>
                  <strong>{plural(vendor.leadTimeDays, "day")}</strong>
                </div>
                <div>
                  <span>Payment terms</span>
                  <strong>{vendor.paymentTerms}</strong>
                </div>
                <div>
                  <span>Reliability</span>
                  <strong>{vendor.reliability}/100</strong>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
