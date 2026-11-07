"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
export default function PaymentResult() {
  const { state, hydrated, refresh } = useDemo();
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!hydrated || !state.customerSession) return;
    let active = true;
    const params = new URLSearchParams(location.search);
    const reference = params.get("reference") || params.get("trxref");
    const order = params.get("order");
    if (!reference) {
      const found = state.orders.find((o) => o.id === order);
      setOrderId(found?.id ?? "");
      setStatus(found?.paymentStatus ?? "unknown");
      return;
    }
    void api<{ status: string; orderId: string }>("/api/checkout", {
      action: "verify",
      reference,
    })
      .then((result) => {
        if (!active) return;
        setStatus(result.status);
        setOrderId(result.orderId);
        if (result.status === "paid")
          sessionStorage.removeItem("paydan-checkout-key");
        void refresh();
      })
      .catch((error) => {
        if (active) {
          setStatus("unknown");
          setError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [hydrated, state.customerSession?.id, attempt]);
  return (
    <div className="payment-state">
      <span className="kicker green">PAYDAN CHECKOUT</span>
      <h1>
        {!state.customerSession
          ? "Sign in to check payment"
          : status === "paid"
            ? "Payment confirmed."
            : status === "checking"
              ? "Checking your payment…"
              : status === "failed"
                ? "Payment was not completed."
                : "Your payment is not yet confirmed."}
      </h1>
      <p>
        {status === "paid"
          ? "Your order is now being processed. Follow its progress from your dashboard."
          : "Payment is confirmed only after PAYDAN checks the transaction with Paystack. You can safely check again."}
      </p>
      {error && <p role="alert">{error}</p>}
      {!state.customerSession ? (
        <Link href="/login?next=%2Faccount%2Forders">Sign in</Link>
      ) : (
        <>
          <button
            onClick={() => {
              setError("");
              setStatus("checking");
              setAttempt((a) => a + 1);
            }}
          >
            Check again
          </button>
          <Link
            href={orderId ? `/account/orders/${orderId}` : "/account/orders"}
          >
            View order
          </Link>
        </>
      )}
      <Link href="/dashboard">Dashboard</Link>
    </div>
  );
}
