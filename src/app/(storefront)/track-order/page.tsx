"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { fulfillmentStatusMeta, paymentStatusMeta } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";

export default function TrackOrderPage() {
  const router = useRouter();
  const { state } = useDemo();

  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const needle = reference.trim().toLowerCase();
    if (!needle) {
      setError("Enter an order reference to continue.");
      return;
    }
    const order = state.orders.find(
      (item) =>
        item.reference.toLowerCase() === needle ||
        item.id === needle ||
        item.trackingCode.toLowerCase() === needle,
    );
    if (!order) {
      setError("No order in your account matches that reference.");
      return;
    }
    router.push(`/track-order/${order.id}`);
  }

  if (!state.customerSession)
    return (
      <div className="payment-state">
        <h1>Track your order</h1>
        <p>Sign in to view your order status.</p>
        <Link href="/login?next=%2Ftrack-order">Sign in</Link>
      </div>
    );
  return (
    <div className="wrap" style={{ paddingBottom: "5rem" }}>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Track order</strong>
      </nav>

      <div className="flow-heading">
        <h1>Track an order</h1>
        <p>
          Enter the reference from your confirmation, or a tracking code.
          Payment and fulfilment are reported separately, and each supplier
          group moves on its own.
        </p>
      </div>

      <form className="track-form" onSubmit={handleSubmit}>
        <label>
          Order reference or tracking code
          <input
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
              setError("");
            }}
            placeholder="e.g. PD-2026-1067 or PDT-1067-C-1"
            aria-invalid={Boolean(error)}
          />
        </label>
        <button type="submit" className="primary">
          Track order
        </button>
        {error ? <p className="form-error">{error}</p> : null}
      </form>

      <section className="track-recent">
        <h2>Your recent orders</h2>
        <p>Only orders belonging to your account appear here.</p>

        <div className="track-list">
          {state.orders.slice(0, 5).map((order) => (
            <Link key={order.id} href={`/track-order/${order.id}`}>
              <div>
                <strong>{order.reference}</strong>
                <small>
                  {order.customerName} · {formatDate(order.placedAt)}
                </small>
              </div>
              <StatusPill tone={paymentStatusMeta[order.paymentStatus].tone}>
                {paymentStatusMeta[order.paymentStatus].label}
              </StatusPill>
              <StatusPill
                tone={fulfillmentStatusMeta[order.fulfillmentStatus].tone}
              >
                {fulfillmentStatusMeta[order.fulfillmentStatus].label}
              </StatusPill>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
