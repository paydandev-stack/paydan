"use client";
import Image from "@/components/safe-image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { PaymentActions } from "@/components/payment-actions";
import { useDemo } from "@/lib/store";
import { formatDate, formatDateTime, money, plural } from "@/lib/format";
import {
  fulfillmentStatusMeta,
  paymentStatusMeta,
  procurementStageMeta,
} from "@/lib/status";
import { StatusPill } from "@/components/status-pill";
export default function AccountOrderPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions } = useDemo();
  const session = state.customerSession;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const order = state.orders.find((item) => item.id === id);
  if (!session || !order || order.customerId !== session.id) notFound();
  const returns = state.returns.filter(
    (request) => request.orderId === order.id,
  );
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/account">Account</Link>
        <span>/</span>
        <Link href="/account/orders">Orders</Link>
        <span>/</span>
        <strong>{order.reference}</strong>
      </nav>

      <h1>{order.reference}</h1>
      <p style={{ color: "var(--muted)", fontSize: ".75rem" }}>
        Placed {formatDate(order.placedAt)} · Tracking {order.trackingCode}
      </p>

      <div className="account-order-status" style={{ marginBottom: "1.5rem" }}>
        <StatusPill tone={paymentStatusMeta[order.paymentStatus].tone}>
          {paymentStatusMeta[order.paymentStatus].label}
        </StatusPill>
        <StatusPill tone={fulfillmentStatusMeta[order.fulfillmentStatus].tone}>
          {fulfillmentStatusMeta[order.fulfillmentStatus].label}
        </StatusPill>
      </div>

      <div className="timeline">
        {order.timeline.map((event, index) => (
          <div
            key={`${event.label}-${index}`}
            className={event.done ? "done" : undefined}
          >
            <span>{index + 1}</span>
            <strong>{event.label}</strong>
            <small>{event.at ? formatDateTime(event.at) : "Pending"}</small>
          </div>
        ))}
      </div>

      <h2>Items</h2>
      <div className="account-items">
        {order.items.map((item) => (
          <div
            className="track-item"
            key={`${item.productId}-${item.variantLabel}`}
          >
            <Image
              src={item.image}
              alt=""
              width={56}
              height={56}
              sizes="56px"
            />
            <div>
              <strong>{item.name}</strong>
              <small>
                {item.variantLabel} · Qty {item.quantity}
              </small>
            </div>
            <span>{money(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
      </div>

      <h2>Delivery groups</h2>
      <div className="account-items">
        {(order.shipments ?? []).map((group) => (
          <div className="account-group" key={group.id}>
            <div>
              <strong>{group.label}</strong>
              <small>ETA {formatDate(group.eta)}</small>
            </div>
            <StatusPill tone="neutral">{group.status}</StatusPill>
          </div>
        ))}
      </div>

      <h2>Payment</h2>
      <div className="track-line">
        <span>Subtotal</span>
        <strong>{money(order.subtotal)}</strong>
      </div>
      <div className="track-line">
        <span>Delivery</span>
        <strong>{money(order.deliveryFee)}</strong>
      </div>
      <div className="track-line total">
        <span>Total</span>
        <strong>{money(order.total)}</strong>
      </div>

      <h2>Delivery address</h2>
      <p style={{ color: "var(--muted)", fontSize: ".74rem", lineHeight: 1.8 }}>
        {order.address.recipient}
        <br />
        {order.address.street}
        {order.address.landmark ? `, ${order.address.landmark}` : ""}
        <br />
        {order.address.city}, {order.address.state}
      </p>

      {returns.length ? (
        <>
          <h2>Returns on this order</h2>
          <div className="account-items">
            {returns.map((request) => (
              <div className="account-group" key={request.id}>
                <div>
                  <strong>{request.reference}</strong>
                  <small>
                    {request.productName} · {plural(request.quantity, "unit")}
                  </small>
                </div>
                <span>{request.status.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {order.paymentStatus !== "paid" && order.paymentStatus !== "refunded" && (
        <PaymentActions
          orderId={order.id}
          reference={order.reference}
          sourced={
            !order.address.street ||
            order.items.some((i) => i.variantLabel === "Sourced to request")
          }
        />
      )}
      <div className="account-actions" style={{ marginTop: "2rem" }}>
        <Link href={`/track-order/${order.id}`}>Track this order</Link>
        <Link href="/account/returns">Request a return</Link>
        {order.paymentStatus === "pending" &&
        order.fulfillmentStatus !== "cancelled" &&
        order.fulfillmentStatus !== "delivered" ? (
          <button
            type="button"
            onClick={async () => {
              try {
                return await actions.cancelOrder(order.id);
              } catch (error) {}
            }}
          >
            Cancel unpaid order
          </button>
        ) : null}
      </div>
    </>
  );
}
