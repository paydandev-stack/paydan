"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
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
  const { state, actions } = useDemo();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const match = state.orders
    .flatMap((order) => order.vendorGroups.map((group) => ({ order, group })))
    .find((entry) => entry.group.id === id);
  const [noteDraft, setNoteDraft] = useState(match?.group.notes ?? "");
  useEffect(() => {
    setNoteDraft(match?.group.notes ?? "");
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
  const saveNote = async () => {
    try {
      await actions.updateVendorStage(
        order.id,
        group.id,
        group.stage,
        noteDraft,
      );
      actions.notify("Vendor group note saved");
    } catch (error) {}
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
                    onClick={async () => {
                      try {
                        return await actions.updateVendorStage(
                          order.id,
                          group.id,
                          stage,
                        );
                      } catch (error) {}
                    }}
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
              <div
                className="admin-actions"
                style={{ marginTop: ".7rem", justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  className="admin-btn"
                  disabled={noteDraft === group.notes}
                  onClick={saveNote}
                >
                  Save note
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
