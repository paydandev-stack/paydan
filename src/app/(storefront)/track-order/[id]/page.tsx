"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useDemo } from "@/lib/store";
import { formatDate, formatDateTime, money, plural } from "@/lib/format";
import {
  fulfillmentStatusMeta,
  paymentStatusMeta,
  procurementStageMeta,
} from "@/lib/status";
import { StatusPill } from "@/components/status-pill";

export default function TrackOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, hydrated } = useDemo();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const order = state.orders.find(
    (item) =>
      item.id === id || item.reference.toLowerCase() === id.toLowerCase(),
  );

  if (!hydrated)
    return (
      <div className="wrap dashboard" aria-busy="true">
        Loading your order…
      </div>
    );
  if (!state.customerSession)
    return (
      <div className="payment-state">
        <h1>Sign in to track your order</h1>
        <Link href="/login?next=%2Ftrack-order">Sign in</Link>
      </div>
    );
  if (
    !state.customerSession ||
    !order ||
    order.customerId !== state.customerSession.id
  )
    notFound();

  const payment = paymentStatusMeta[order.paymentStatus];
  const fulfillment = fulfillmentStatusMeta[order.fulfillmentStatus];

  return (
    <div className="wrap track-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/track-order">Track order</Link>
        <span>/</span>
        <strong>{order.reference}</strong>
      </nav>

      <header className="flow-heading">
        <span className="kicker green">Order tracking</span>
        <h1>{order.reference}</h1>
        <p>
          Placed {formatDate(order.placedAt)} ·{" "}
          {plural(order.items.length, "item")} ·{" "}
          {plural(order.shipments?.length ?? 0, "delivery group")}
        </p>
        <div className="track-badges">
          <StatusPill tone={payment.tone}>{payment.label}</StatusPill>
          <StatusPill tone={fulfillment.tone}>{fulfillment.label}</StatusPill>
          <span className="track-code">{order.trackingCode}</span>
        </div>
      </header>

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

      <section className="track-groups">
        <h2>Delivery progress</h2>
        {(order.shipments ?? []).map((group) => (
          <article className="track-group" key={group.id}>
            <header>
              <strong>{group.label}</strong>
              <span>{group.status}</span>
            </header>
            <p>
              Estimated delivery:{" "}
              {group.eta || "We’ll update you when scheduled"}
            </p>
            {group.items.map((item, index) => (
              <div className="track-item" key={index}>
                <Image src={item.image} alt="" width={56} height={56} />
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.variantLabel} × {item.quantity}
                  </small>
                </div>
              </div>
            ))}
          </article>
        ))}
      </section>

      <section className="track-summary">
        <div>
          <h2>Delivery</h2>
          <p>
            {order.address.recipient}
            <br />
            {order.address.street}
            {order.address.landmark ? `, ${order.address.landmark}` : ""}
            <br />
            {order.address.city}, {order.address.state}
            <br />
            {order.address.phone}
          </p>
        </div>

        <div>
          <h2>Payment</h2>
          <div className="track-line">
            <span>Subtotal</span>
            <strong>{money(order.subtotal)}</strong>
          </div>
          <div className="track-line">
            <span>Delivery</span>
            <strong>{money(order.deliveryFee)}</strong>
          </div>
          <div className="track-line">
            <span>Discount</span>
            <strong>
              {order.discount ? `- ${money(order.discount)}` : "—"}
            </strong>
          </div>
          <div className="track-line total">
            <span>Total</span>
            <strong>{money(order.total)}</strong>
          </div>
          <small>
            Method:{" "}
            {order.paymentMethod === "paystack" ? "Paystack" : "Bank transfer"}
          </small>
        </div>
      </section>

      <p className="track-help">
        Something wrong with this order?{" "}
        <Link href="/contact">Contact support</Link> with the reference{" "}
        {order.reference}.
      </p>
    </div>
  );
}
