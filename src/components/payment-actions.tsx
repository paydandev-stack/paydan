"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
export function PaymentActions({
  orderId,
  reference,
  sourced = false,
}: {
  orderId: string;
  reference: string;
  sourced?: boolean;
}) {
  const { refresh } = useDemo();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function action(name: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url?: string; status?: string }>(
        "/api/checkout",
        { action: name, orderId, reference },
      );
      if (result.url) location.assign(result.url);
      else {
        await refresh();
        setError(
          result.status === "paid"
            ? "Payment confirmed."
            : `Payment status: ${result.status ?? "pending"}`,
        );
        if (result.status === "failed")
          sessionStorage.removeItem("paydan-checkout-key");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="resume-card">
      <div>
        <h2>Payment</h2>
        <p role="status">
          {error || "Complete your payment or check its latest status."}
        </p>
        {sourced && (
          <Link href={`/checkout?order=${orderId}`}>Review delivery & pay</Link>
        )}
        <button disabled={busy} onClick={() => void action("resume")}>
          Resume Paystack
        </button>
        <button disabled={busy} onClick={() => void action("verify")}>
          Check payment status
        </button>
        <Link href="/cart">Review cart</Link>
      </div>
    </div>
  );
}
