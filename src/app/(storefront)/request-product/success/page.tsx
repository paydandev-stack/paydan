"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";

export default function RequestProductSuccessPage() {
  const { state } = useDemo();
  const reference = state.lastSourcingReference;

  if (!reference)
    return (
      <div className="payment-state">
        <h1>Your sourcing requests</h1>
        <Link href="/account/sourcing-requests">View your requests</Link>
      </div>
    );
  return (
    <div className="wrap success-page">
      <div className="success-mark">✓</div>
      <h1>Request received</h1>
      <p>
        {reference ? (
          <>
            Your sourcing request <strong>{reference}</strong> is in the queue.
            Paydan&rsquo;s team will look for a supplier and send a quotation
            with a price and delivery estimate.
          </>
        ) : (
          <>
            Your sourcing request is in the queue. Paydan&rsquo;s team will look
            for a supplier and send a quotation with a price and delivery
            estimate.
          </>
        )}
        <br />
        Nothing has been charged, and no order exists until you accept a
        quotation.
      </p>

      <div className="request-next">
        <div>
          <strong>1</strong>
          <span>We review the specification</span>
        </div>
        <div>
          <strong>2</strong>
          <span>We confirm a supplier and price</span>
        </div>
        <div>
          <strong>3</strong>
          <span>You accept or decline the quote</span>
        </div>
      </div>

      <div className="success-actions">
        <Link href="/account/sourcing-requests">View sourcing requests</Link>
        <Link href="/shop">Continue shopping</Link>
      </div>
    </div>
  );
}
