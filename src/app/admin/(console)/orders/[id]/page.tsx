"use client";
import Image from "@/components/safe-image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmSupply } from "@/components/admin/confirm-supply";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminSelect,
  AdminTable,
  AdminTextArea,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDate, formatDateTime, money, plural } from "@/lib/format";
import {
  fulfillmentStatusMeta,
  paymentStatusMeta,
  procurementStageMeta,
} from "@/lib/status";
import { orderCost } from "@/lib/order-math";
import type { FulfillmentStatus, PaymentStatus } from "@/lib/types";
const paymentOptions = Object.entries(paymentStatusMeta).map(
  ([value, meta]) => ({
    value,
    label: meta.label,
  }),
);
const fulfilmentOptions = Object.entries(fulfillmentStatusMeta).map(
  ([value, meta]) => ({
    value,
    label: meta.label,
  }),
);
const paymentMethodLabel: Record<"paystack" | "transfer", string> = {
  paystack: "Paystack",
  transfer: "Bank transfer",
};
/** Full order record: status controls, line economics, supplier groups and timeline. */
export default function AdminOrderDetailPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions } = useDemo();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const order = state.orders.find((item) => item.id === id);
  const [notesDraft, setNotesDraft] = useState(order?.notes ?? "");
  const [pendingFulfilment, setPendingFulfilment] =
    useState<FulfillmentStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => {
    setNotesDraft(order?.notes ?? "");
    setPendingFulfilment(null);
    setConfirmCancel(false);
    // Reset local edits whenever a different order is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);
  if (!order) notFound();
  const canManage = ["Super Admin", "Order Manager"].includes(
    state.adminSession?.role ?? "",
  );
  if (state.adminSession?.role === "Support")
    return (
      <>
        <AdminPageHeader
          eyebrow="Customer support"
          title={order.reference}
          description={`${order.customerName} · ${order.customerEmail}`}
        />
        <section className="admin-card">
          <h3>Order status</h3>
          <p>
            {paymentStatusMeta[order.paymentStatus].label} ·{" "}
            {fulfillmentStatusMeta[order.fulfillmentStatus].label}
          </p>
          <p>Total: {money(order.total)}</p>
          <h3>Items</h3>
          {order.items.map((item, i) => (
            <p key={i}>
              {item.name} · {item.variantLabel} × {item.quantity}
            </p>
          ))}
          <h3>Delivery</h3>
          <p>
            {order.address.recipient} · {order.address.street},{" "}
            {order.address.city}, {order.address.state}
          </p>
          {order.shipments?.map((group) => (
            <p key={group.id}>
              {group.label}: {group.status} · {group.eta}
            </p>
          ))}
          <h3>Timeline</h3>
          {order.timeline.map((event, i) => (
            <p key={i}>
              {event.label} · {event.at ? formatDateTime(event.at) : "Pending"}
            </p>
          ))}
          <Link href="/admin/support">Open support inbox</Link>
        </section>
      </>
    );
  const vendorName = (vendorId: string) =>
    state.vendors.find((vendor) => vendor.id === vendorId)?.name ?? vendorId;
  const cost = orderCost(order);
  const discountBase = order.subtotal - order.discount;
  const margin = discountBase - cost;
  const marginPct =
    discountBase > 0 ? Math.round((margin / discountBase) * 100) : 0;
  const saveNotes = async () => {
    try {
      await actions.updateOrderStatus(order.id, { notes: notesDraft });
      actions.notify("Order notes saved");
    } catch (error) {}
  };
  const applyFulfilment = async () => {
    try {
      if (!pendingFulfilment) return;
      await actions.updateOrderStatus(order.id, {
        fulfillmentStatus: pendingFulfilment,
      });
      actions.notify(
        `${order.reference} marked ${fulfillmentStatusMeta[pendingFulfilment].label}`,
      );
      setPendingFulfilment(null);
    } catch (error) {}
  };
  return (
    <>
      <ConfirmSupply order={order} />
      <AdminPageHeader
        eyebrow="Order detail"
        title={order.reference}
        description={`Placed ${formatDate(order.placedAt)} · Tracking ${order.trackingCode} · ${order.customerName} · ${fulfillmentStatusMeta[order.fulfillmentStatus].label}`}
        action={
          <Link className="admin-btn quiet" href="/admin/orders">
            All orders
          </Link>
        }
      />

      <div className="admin-detail">
        <div style={{ display: "grid", gap: "1rem" }}>
          {canManage && (
            <section className="admin-card">
              <h3>Status and handling</h3>
              <div className="form-grid">
                <div className="admin-field">
                  <span>Payment status</span>
                  <strong>
                    {paymentStatusMeta[order.paymentStatus].label}
                  </strong>
                  <small>
                    Verified by Paystack. Payment status cannot be edited
                    manually.
                  </small>
                  <small>{paymentStatusMeta[order.paymentStatus].hint}</small>
                </div>

                <div className="admin-field">
                  <span>Fulfilment status</span>
                  <AdminSelect
                    label="Fulfilment status"
                    value={pendingFulfilment ?? order.fulfillmentStatus}
                    onChange={(value) =>
                      setPendingFulfilment(value as FulfillmentStatus)
                    }
                    options={fulfilmentOptions}
                  />
                  <small>
                    Stage changes are confirmed inline before they are applied.
                  </small>
                </div>
              </div>

              {pendingFulfilment &&
              pendingFulfilment !== order.fulfillmentStatus ? (
                <div
                  className="admin-note"
                  role="status"
                  style={{ marginTop: ".9rem" }}
                >
                  Set {order.reference} to{" "}
                  <strong>
                    {fulfillmentStatusMeta[pendingFulfilment].label}
                  </strong>
                  ? The order timeline records this change. Supplier groups are
                  managed separately.
                  <div className="admin-actions" style={{ marginTop: ".6rem" }}>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={applyFulfilment}
                    >
                      Apply change
                    </button>
                    <button
                      type="button"
                      className="admin-btn quiet"
                      onClick={() => setPendingFulfilment(null)}
                    >
                      Keep{" "}
                      {fulfillmentStatusMeta[order.fulfillmentStatus].label}
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: "1.2rem" }}>
                <AdminTextArea
                  label="Internal order notes"
                  wide
                  hint="Operator notes stored on the order record."
                  rows={4}
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                />
                <div
                  className="admin-actions"
                  style={{ marginTop: ".7rem", justifyContent: "flex-end" }}
                >
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={notesDraft === order.notes}
                    onClick={saveNotes}
                  >
                    Save notes
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: "1.2rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--border)",
                }}
              >
                {order.fulfillmentStatus === "cancelled" ? (
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: ".66rem",
                      margin: 0,
                    }}
                  >
                    This order is cancelled; vendor groups are blocked. Payment
                    status shows any refund recorded on the record.
                  </p>
                ) : confirmCancel ? (
                  <div>
                    <p>
                      Cancel this unpaid order? Payments already in progress
                      must be reconciled first.
                    </p>
                    <button
                      className="admin-btn danger"
                      onClick={async () => {
                        try {
                          await actions.cancelOrder(order.id);
                          setConfirmCancel(false);
                        } catch {}
                      }}
                    >
                      Confirm cancellation
                    </button>
                    <button onClick={() => setConfirmCancel(false)}>
                      Keep order
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="admin-btn danger"
                    disabled={order.paymentStatus !== "pending"}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel order
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="admin-card">
            <h3>Items</h3>
            <AdminTable
              template="1.5fr .5fr .8fr .8fr .9fr"
              head={["Item", "Qty", "Unit price", "Cost", "Line margin"]}
              caption={`The ${plural(order.items.length, "item")} on ${order.reference}`}
            >
              {order.items.map((item, index) => {
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
                    <span
                      style={{
                        display: "flex",
                        gap: ".55rem",
                        alignItems: "center",
                      }}
                    >
                      <Image
                        src={item.image}
                        alt=""
                        width={40}
                        height={40}
                        sizes="40px"
                        style={{
                          borderRadius: ".4rem",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <small
                          style={{ display: "block", color: "var(--muted)" }}
                        >
                          {item.variantLabel}
                        </small>
                      </span>
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
          </section>

          <section className="admin-card">
            <h3>Order timeline</h3>
            <div className="timeline" style={{ margin: "1.2rem 0 0" }}>
              {order.timeline.map((event, index) => (
                <div
                  key={`${event.label}-${index}`}
                  className={event.done ? "done" : undefined}
                >
                  <span>{index + 1}</span>
                  <strong>{event.label}</strong>
                  <small>
                    {event.at ? formatDateTime(event.at) : "Pending"}
                  </small>
                  {event.note ? (
                    <small style={{ color: "var(--muted)" }}>
                      {event.note}
                    </small>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="admin-card">
            <h3>Totals</h3>
            <div className="admin-meta">
              <div>
                <span>Subtotal</span>
                <strong>{money(order.subtotal)}</strong>
              </div>
              <div>
                <span>Delivery fee</span>
                <strong>{money(order.deliveryFee)}</strong>
              </div>
              <div>
                <span>Discount</span>
                <strong>
                  {order.discount > 0 ? `− ${money(order.discount)}` : money(0)}
                </strong>
              </div>
              <div>
                <span>Order total</span>
                <strong>{money(order.total)}</strong>
              </div>
              <div>
                <span>Item cost (internal)</span>
                <strong>{money(cost)}</strong>
              </div>
              <div>
                <span>Goods margin</span>
                <strong>
                  {money(margin)} · {marginPct}%
                </strong>
              </div>
            </div>
            <p style={{ marginTop: ".8rem" }}>
              Goods margin is subtotal less discount and item cost; the delivery
              fee is excluded.
            </p>
          </section>

          <section className="admin-card">
            <h3>Supplier groups</h3>
            {order.vendorGroups.length === 0 ? (
              <p>No supplier groups on this order yet.</p>
            ) : (
              order.vendorGroups.map((group) => (
                <div className="queue-item" key={group.id}>
                  <span>
                    <Link
                      href={`/admin/procurement/${group.id}`}
                      style={{ color: "var(--green)", fontWeight: 700 }}
                    >
                      {vendorName(group.vendorId)}
                    </Link>
                    <small style={{ display: "block", color: "var(--muted)" }}>
                      {plural(group.items.length, "item")} · ETA{" "}
                      {formatDate(group.eta)}
                      {group.urgent ? " · Urgent" : ""}
                    </small>
                  </span>
                  <StatusPill tone={procurementStageMeta[group.stage].tone}>
                    {procurementStageMeta[group.stage].label}
                  </StatusPill>
                </div>
              ))
            )}
          </section>

          <section className="admin-card">
            <h3>Customer and delivery</h3>
            <div className="admin-meta">
              <div>
                <span>Customer</span>
                <strong>{order.customerName}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{order.customerEmail}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{order.customerPhone}</strong>
              </div>
              <div>
                <span>Payment method</span>
                <strong>{paymentMethodLabel[order.paymentMethod]}</strong>
              </div>
              <div>
                <span>Recipient</span>
                <strong>{order.address.recipient}</strong>
              </div>
              <div>
                <span>Street</span>
                <strong>
                  {order.address.street}
                  {order.address.landmark ? `, ${order.address.landmark}` : ""}
                </strong>
              </div>
              <div>
                <span>City</span>
                <strong>{order.address.city}</strong>
              </div>
              <div>
                <span>State</span>
                <strong>{order.address.state}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
