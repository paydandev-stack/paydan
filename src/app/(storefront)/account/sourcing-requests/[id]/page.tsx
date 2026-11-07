"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useDemo } from "@/lib/store";
import { formatDate, money } from "@/lib/format";
import { sourcingStatusMeta } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";
export default function AccountSourcingDetailPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions } = useDemo();
  const session = state.customerSession;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const request = state.sourcing.find((item) => item.id === id);
  if (!session || !request || request.customerId !== session.id) notFound();
  const status = sourcingStatusMeta[request.status];
  const quote = request.quote;
  const canRespond =
    request.status === "awaiting_customer" && quote?.status === "sent";
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/account">Account</Link>
        <span>/</span>
        <Link href="/account/sourcing-requests">Sourcing</Link>
        <span>/</span>
        <strong>{request.reference}</strong>
      </nav>

      <h1>{request.reference}</h1>
      <p style={{ color: "var(--muted)", fontSize: ".75rem" }}>
        Submitted {formatDate(request.submittedAt)} · Assigned to{" "}
        {request.assignee}
      </p>
      <div className="account-order-status" style={{ marginBottom: "1.5rem" }}>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>

      <h2>What you asked for</h2>
      <div className="request-detail">
        <div>
          <span>Product</span>
          <strong>{request.productName}</strong>
        </div>
        <div>
          <span>Quantity</span>
          <strong>{request.quantity}</strong>
        </div>
        <div>
          <span>Budget</span>
          <strong>
            {request.budget ? money(request.budget) : "Not specified"}
          </strong>
        </div>
        <div>
          <span>Deliver to</span>
          <strong>
            {request.city}, {request.state}
          </strong>
        </div>
      </div>
      {request.description ? (
        <p
          style={{ color: "var(--muted)", fontSize: ".74rem", lineHeight: 1.8 }}
        >
          {request.description}
        </p>
      ) : null}

      <h2>Quotation</h2>
      {quote ? (
        <div className="quote-card">
          <div className="quote-lines">
            {quote.lines.map((line) => (
              <div key={line.id}>
                <span>
                  {line.description} × {line.quantity}
                </span>
                <strong>{money(line.unitPrice * line.quantity)}</strong>
              </div>
            ))}
          </div>
          <div className="track-line total">
            <span>Quoted total</span>
            <strong>{money(quote.total)}</strong>
          </div>
          <p
            style={{
              color: "var(--muted)",
              fontSize: ".7rem",
              lineHeight: 1.7,
            }}
          >
            Delivery estimate: {quote.deliveryEstimate}
            <br />
            Valid until {formatDate(quote.validUntil)}
            {quote.note ? (
              <>
                <br />
                {quote.note}
              </>
            ) : null}
          </p>

          {canRespond ? (
            <div className="account-actions">
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  try {
                    return await actions.respondToQuote(request.id, "accepted");
                  } catch (error) {}
                }}
              >
                Accept quotation
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    return await actions.respondToQuote(request.id, "declined");
                  } catch (error) {}
                }}
              >
                Decline
              </button>
            </div>
          ) : null}

          {request.status === "converted" && request.convertedOrderId ? (
            <p style={{ fontSize: ".72rem" }}>
              Converted to order{" "}
              <Link
                href={`/account/orders/${request.convertedOrderId}`}
                style={{ color: "var(--green)", fontWeight: 700 }}
              >
                {request.convertedOrderId}
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: ".74rem" }}>
          No quotation yet. Our team is still checking suppliers — you will see
          the quote here once it is ready.
        </p>
      )}
    </>
  );
}
