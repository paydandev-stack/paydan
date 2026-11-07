"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";
import { formatDate, money } from "@/lib/format";
import { sourcingStatusMeta } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";

export default function AccountSourcingPage() {
  const { state } = useDemo();
  const session = state.customerSession;
  if (!session) return null;

  const requests = state.sourcing.filter(
    (request) => request.customerId === session.id,
  );

  return (
    <>
      <h1>Sourcing requests</h1>
      <p style={{ color: "var(--muted)", fontSize: ".75rem" }}>
        Requests for products outside the catalogue. Each one gets a quotation
        you can accept or decline.
      </p>

      {requests.length === 0 ? (
        <div className="empty" style={{ marginTop: "2rem" }}>
          <h3>No sourcing requests yet</h3>
          <p>Ask Paydan to find a product and we&rsquo;ll send a quotation.</p>
          <Link href="/request-product">Make a request</Link>
        </div>
      ) : (
        <div className="account-items" style={{ marginTop: "2rem" }}>
          {requests.map((request) => (
            <article className="account-group" key={request.id}>
              <div>
                <strong>
                  {request.reference} · {request.productName}
                </strong>
                <small>
                  {formatDate(request.submittedAt)} · Qty {request.quantity}
                  {request.quote
                    ? ` · Quote ${money(request.quote.total)}`
                    : ""}
                </small>
              </div>
              <div className="account-order-status">
                <StatusPill tone={sourcingStatusMeta[request.status].tone}>
                  {sourcingStatusMeta[request.status].label}
                </StatusPill>
                <Link href={`/account/sourcing-requests/${request.id}`}>
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
