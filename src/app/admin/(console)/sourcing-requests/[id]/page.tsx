"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminSelect,
  AdminTextArea,
  AdminTextField,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import {
  formatDate,
  formatDateTime,
  money,
  plural,
  todayISO,
} from "@/lib/format";
import { sourcingStatusMeta, type Tone } from "@/lib/status";
import { categoryName } from "@/data/categories";
import type { Quote, SourcingStatus } from "@/lib/types";
type DraftLine = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};
const quoteStatusMeta: Record<
  Quote["status"],
  {
    label: string;
    tone: Tone;
  }
> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent to customer", tone: "blue" },
  accepted: { label: "Accepted", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  expired: { label: "Expired", tone: "orange" },
};
const statusOptions = Object.entries(sourcingStatusMeta).map(
  ([value, meta]) => ({
    value,
    label: meta.label,
  }),
);
const qtyOf = (value: string) => Math.max(1, Math.round(Number(value) || 1));
const priceOf = (value: string) => Math.max(0, Math.round(Number(value) || 0));
function toDraftLines(quote?: Quote): DraftLine[] {
  return (quote?.lines ?? []).map((line) => ({
    id: line.id,
    description: line.description,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
  }));
}
function linesTotal(lines: DraftLine[]): number {
  return lines.reduce(
    (sum, line) => sum + qtyOf(line.quantity) * priceOf(line.unitPrice),
    0,
  );
}
function builderSignature(
  lines: DraftLine[],
  validUntil: string,
  deliveryEstimate: string,
  note: string,
): string {
  return JSON.stringify([
    lines.map((line) => [
      line.id,
      line.description.trim(),
      qtyOf(line.quantity),
      priceOf(line.unitPrice),
    ]),
    validUntil,
    deliveryEstimate.trim(),
    note.trim(),
  ]);
}
function dateInputToIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return todayISO(14);
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}
/** Sourcing detail: brief, assignment, status and a full quote workflow. */
export default function AdminSourcingRequestPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions } = useDemo();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const request = state.sourcing.find((item) => item.id === id);
  const [assigneeDraft, setAssigneeDraft] = useState(request?.assignee ?? "");
  const [notesDraft, setNotesDraft] = useState(request?.adminNotes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    toDraftLines(request?.quote),
  );
  const [validUntil, setValidUntil] = useState(() =>
    request?.quote?.validUntil
      ? request.quote.validUntil.slice(0, 10)
      : todayISO(14).slice(0, 10),
  );
  const [deliveryEstimate, setDeliveryEstimate] = useState(
    request?.quote?.deliveryEstimate ?? "",
  );
  const [quoteNote, setQuoteNote] = useState(request?.quote?.note ?? "");
  useEffect(() => {
    if (!request) return;
    setAssigneeDraft(request.assignee);
    setNotesDraft(request.adminNotes);
    setLines(toDraftLines(request.quote));
    setValidUntil(
      request.quote?.validUntil
        ? request.quote.validUntil.slice(0, 10)
        : todayISO(14).slice(0, 10),
    );
    setDeliveryEstimate(request.quote?.deliveryEstimate ?? "");
    setQuoteNote(request.quote?.note ?? "");
    // Reset every editor when a different request is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);
  if (!request) notFound();
  if (state.adminSession?.role === "Support")
    return (
      <>
        <AdminPageHeader
          eyebrow="Sourcing request"
          title={request.reference}
          description={`${request.customerName} · ${request.email}`}
        />
        <section className="admin-card">
          <h3>{request.productName}</h3>
          <p>{request.description}</p>
          <p>
            Quantity: {request.quantity} · {request.city}, {request.state}
          </p>
          <p>Status: {sourcingStatusMeta[request.status].label}</p>
          {request.images.map((url) => (
            <p key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                View attachment
              </a>
            </p>
          ))}
          {request.quote && (
            <p>
              Quote: {request.quote.status} · {money(request.quote.total)}
            </p>
          )}
          <p>The procurement team manages supplier confirmation and quotes.</p>
          <Link href="/admin/support">Open support inbox</Link>
        </section>
      </>
    );
  const quote = request.quote;
  const terminal = ["converted", "cancelled"].includes(request.status);
  const total = linesTotal(lines);
  const hasDescribableLine = lines.some(
    (line) => line.description.trim() !== "",
  );
  const savedSignature = quote
    ? builderSignature(
        toDraftLines(quote),
        quote.validUntil.slice(0, 10),
        quote.deliveryEstimate,
        quote.note,
      )
    : null;
  const dirty =
    savedSignature === null
      ? lines.length > 0 ||
        deliveryEstimate.trim() !== "" ||
        quoteNote.trim() !== ""
      : builderSignature(lines, validUntil, deliveryEstimate, quoteNote) !==
        savedSignature;
  const canSave = !terminal && lines.length > 0 && hasDescribableLine && dirty;
  const canSend =
    !terminal && quote !== undefined && quote.status === "draft" && !dirty;
  const canRespond = quote !== undefined && quote.status === "sent";
  const canConvert =
    quote !== undefined &&
    quote.status === "accepted" &&
    request.status !== "converted";
  const assignmentDirty =
    assigneeDraft !== request.assignee || notesDraft !== request.adminNotes;
  const workflowHint = terminal
    ? request.status === "converted"
      ? "This request has already been converted — the quote workflow is closed."
      : "This request is cancelled — the quote workflow is closed."
    : !canRespond && !canConvert
      ? quote?.status === "draft"
        ? "Accept, decline and conversion unlock once the quote has been sent to the customer."
        : quote?.status === "declined" || quote?.status === "expired"
          ? "Declined quotes stay closed — save a revised draft and send it again to reopen."
          : "Accept, decline and conversion unlock once the quote is accepted."
      : !canConvert
        ? "Converting to an order unlocks once the quote is accepted."
        : "";
  const convertedOrder = request.convertedOrderId
    ? state.orders.find((order) => order.id === request.convertedOrderId)
    : undefined;
  const builderHint = terminal
    ? "This request is closed to quote edits."
    : lines.length === 0
      ? "Add at least one line before saving the draft."
      : !hasDescribableLine
        ? "Give every line a description before saving."
        : dirty
          ? "Unsaved changes — save the draft before sending the quote."
          : !quote
            ? "Save the draft to create the quotation, then send it."
            : quote.status === "draft"
              ? "Draft saved and ready to send."
              : quote.status === "sent"
                ? "Quote sent — awaiting the customer's response."
                : quote.status === "accepted"
                  ? "Quote accepted — convert it to an order below."
                  : "Quote recorded as declined; revise and save a draft to reopen it.";
  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...state.team.map((member) => ({
      value: member.name,
      label: `${member.name} · ${member.role}`,
    })),
    ...(request.assignee &&
    !state.team.some((member) => member.name === request.assignee)
      ? [{ value: request.assignee, label: request.assignee }]
      : []),
    ...(assigneeDraft &&
    assigneeDraft !== request.assignee &&
    !state.team.some((member) => member.name === assigneeDraft)
      ? [{ value: assigneeDraft, label: assigneeDraft }]
      : []),
  ];
  const saveAssignment = async () => {
    try {
      await actions.updateSourcing(request.id, {
        assignee: assigneeDraft,
        adminNotes: notesDraft,
      });
      actions.notify(`Assignment and notes saved on ${request.reference}`);
    } catch (error) {}
  };
  const changeStatus = async (value: string) => {
    try {
      const next = value as SourcingStatus;
      await actions.setSourcingStatus(request.id, next);
      actions.notify(
        `${request.reference} set to ${sourcingStatusMeta[next].label}`,
      );
    } catch (error) {}
  };
  const saveDraft = async () => {
    try {
      const draftQuote: Quote = {
        id: quote?.id ?? `q-${request.id}`,
        lines: lines.map((line) => ({
          id: line.id,
          description: line.description.trim(),
          quantity: qtyOf(line.quantity),
          unitPrice: priceOf(line.unitPrice),
        })),
        total,
        validUntil: dateInputToIso(validUntil),
        deliveryEstimate: deliveryEstimate.trim(),
        status: "draft",
        note: quoteNote.trim(),
        ...(quote?.sentAt ? { sentAt: quote.sentAt } : {}),
      };
      await actions.saveQuote(request.id, draftQuote);
      actions.notify(`Quote draft saved on ${request.reference}`);
    } catch (error) {}
  };
  const sendQuote = async () => {
    try {
      await actions.sendQuote(request.id);
      actions.notify(`Quote sent for ${request.reference}`);
    } catch (error) {}
  };
  const respond = async (response: "accepted" | "declined") => {
    try {
      await actions.respondToQuote(request.id, response);
      actions.notify(
        response === "accepted"
          ? `${request.reference} quote accepted`
          : `${request.reference} quote declined`,
      );
    } catch (error) {}
  };
  const convert = async () => {
    try {
      const orderId = await actions.convertQuoteToOrder(request.id);
      if (orderId) {
        actions.notify(`Order created from ${request.reference}`, "success", {
          actionLabel: "Open order",
          actionHref: `/admin/orders/${orderId}`,
        });
      }
    } catch (error) {}
  };
  const updateLine = (lineId: string, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) =>
        line.id === lineId ? { ...line, ...patch } : line,
      ),
    );
  const addLine = () =>
    setLines((current) => [
      ...current,
      {
        id: `ql-${request.id}-${Date.now()}`,
        description: "",
        quantity: "1",
        unitPrice: "",
      },
    ]);
  const removeLine = (lineId: string) =>
    setLines((current) => current.filter((line) => line.id !== lineId));
  return (
    <>
      <AdminPageHeader
        eyebrow="Sourcing request"
        title={request.reference}
        description={`${request.productName} · submitted ${formatDate(request.submittedAt)} · ${sourcingStatusMeta[request.status].label}`}
        action={
          <Link className="admin-btn quiet" href="/admin/sourcing-requests">
            Back to queue
          </Link>
        }
      />

      <div className="admin-detail">
        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="admin-card">
            <h3>Customer</h3>
            <div className="admin-meta">
              <div>
                <span>Name</span>
                <strong>{request.customerName}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{request.email}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{request.phone}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>
                  {request.city}, {request.state}
                </strong>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <h3>Product brief</h3>
            <div className="admin-meta">
              <div>
                <span>Product</span>
                <strong>{request.productName}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{categoryName(request.categorySlug)}</strong>
              </div>
              <div>
                <span>Quantity</span>
                <strong>{plural(request.quantity, "unit")}</strong>
              </div>
              <div>
                <span>Budget</span>
                <strong>
                  {request.budget ? money(request.budget) : "No budget given"}
                </strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>
                  {request.city}, {request.state}
                </strong>
              </div>
              <div>
                <span>Submitted</span>
                <strong>{formatDateTime(request.submittedAt)}</strong>
              </div>
              <div>
                <span>Assignee</span>
                <strong>{request.assignee || "Unassigned"}</strong>
              </div>
            </div>
            <p>{request.description}</p>
          </section>

          <section className="admin-card">
            <h3>Quote builder</h3>
            <p>
              Lines, validity, delivery estimate and note are saved as a draft
              quotation with {money(total)} computed from the lines.
            </p>

            {lines.length === 0 ? (
              <div className="admin-note" style={{ marginTop: ".8rem" }}>
                No lines yet — add the first line below.
              </div>
            ) : null}

            <div style={{ marginTop: ".9rem" }}>
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className="form-grid"
                  style={{
                    marginBottom: ".9rem",
                    paddingBottom: ".9rem",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <AdminTextField
                    label={`Line ${index + 1} description`}
                    wide
                    value={line.description}
                    placeholder="What the supplier will deliver"
                    onChange={(event) =>
                      updateLine(line.id, { description: event.target.value })
                    }
                  />
                  <AdminTextField
                    label="Quantity"
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.id, { quantity: event.target.value })
                    }
                  />
                  <AdminTextField
                    label="Unit price (NGN)"
                    type="number"
                    min={0}
                    step={100}
                    value={line.unitPrice}
                    onChange={(event) =>
                      updateLine(line.id, { unitPrice: event.target.value })
                    }
                  />
                  <div
                    className="admin-actions"
                    style={{
                      gridColumn: "1 / -1",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "var(--muted)", fontSize: ".65rem" }}>
                      Line total{" "}
                      {money(qtyOf(line.quantity) * priceOf(line.unitPrice))}
                    </span>
                    <button
                      type="button"
                      className="admin-btn danger"
                      aria-label={`Remove quote line ${index + 1}`}
                      onClick={() => removeLine(line.id)}
                    >
                      Remove line
                    </button>
                  </div>
                </div>
              ))}

              <div className="admin-actions">
                <button
                  type="button"
                  className="admin-btn quiet"
                  onClick={addLine}
                >
                  Add line
                </button>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: "1rem" }}>
              <AdminTextField
                label="Valid until"
                type="date"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
              <AdminTextField
                label="Delivery estimate"
                value={deliveryEstimate}
                placeholder="7-10 working days after acceptance"
                onChange={(event) => setDeliveryEstimate(event.target.value)}
              />
              <AdminTextArea
                label="Quote note"
                wide
                rows={3}
                hint="Shown to the customer alongside the quotation."
                value={quoteNote}
                onChange={(event) => setQuoteNote(event.target.value)}
              />
            </div>

            <div className="admin-meta" style={{ marginTop: "1rem" }}>
              <div>
                <span>Quote total (from lines)</span>
                <strong>{money(total)}</strong>
              </div>
              <div>
                <span>Saved quotation</span>
                <strong>
                  {quote
                    ? `${money(quote.total)} · ${quoteStatusMeta[quote.status].label}`
                    : "Not saved yet"}
                </strong>
              </div>
            </div>

            {builderHint ? (
              <div
                className={canSend ? "admin-notice" : "admin-note"}
                style={{ marginTop: ".9rem" }}
              >
                {builderHint}
              </div>
            ) : null}

            <div
              className="admin-actions"
              style={{ marginTop: "1rem", justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="admin-btn quiet"
                disabled={!canSave}
                onClick={saveDraft}
              >
                Save draft
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={!canSend}
                onClick={sendQuote}
              >
                Send quote
              </button>
            </div>
          </section>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="admin-card">
            <h3>Assignment</h3>
            {request.images.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                View reference image
              </a>
            ))}
            <div style={{ display: "grid", gap: ".9rem" }}>
              <div className="admin-field">
                <span>Assignee</span>
                <AdminSelect
                  label="Assignee"
                  value={assigneeDraft}
                  onChange={setAssigneeDraft}
                  options={assigneeOptions}
                />
              </div>
              <AdminTextArea
                label="Admin notes"
                wide
                rows={4}
                hint="Internal handling notes for this request."
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
              />
              <div
                className="admin-actions"
                style={{ justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  className="admin-btn"
                  disabled={!assignmentDirty}
                  onClick={saveAssignment}
                >
                  Save assignment
                </button>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <h3>Status</h3>
            <div className="admin-field">
              <span>Request status</span>
              <AdminSelect
                label="Request status"
                value={request.status}
                onChange={changeStatus}
                options={statusOptions.filter((option) =>
                  [
                    "received",
                    "under_review",
                    "vendor_sourcing",
                    "cancelled",
                    request.status,
                  ].includes(option.value),
                )}
              />
            </div>
            <p style={{ marginTop: ".8rem" }}>
              {sourcingStatusMeta[request.status].hint ??
                "Status changes are recorded on the request immediately."}
            </p>
            {convertedOrder ? (
              <div className="admin-notice" style={{ marginTop: ".8rem" }}>
                Converted to order{" "}
                <Link
                  href={`/admin/orders/${convertedOrder.id}`}
                  style={{ color: "var(--green)", fontWeight: 700 }}
                >
                  {convertedOrder.reference}
                </Link>
                .
              </div>
            ) : null}
            {request.convertedOrderId && !convertedOrder ? (
              <div className="admin-notice" style={{ marginTop: ".8rem" }}>
                Converted to order {request.convertedOrderId}.
              </div>
            ) : null}
          </section>

          <section className="admin-card">
            <h3>Quotation</h3>
            {!quote ? (
              <p>
                No quotation saved for this request yet — build one in the quote
                builder.
              </p>
            ) : (
              <>
                <div className="admin-meta">
                  <div>
                    <span>Status</span>
                    <strong>
                      <StatusPill tone={quoteStatusMeta[quote.status].tone}>
                        {quoteStatusMeta[quote.status].label}
                      </StatusPill>
                    </strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{money(quote.total)}</strong>
                  </div>
                  <div>
                    <span>Lines</span>
                    <strong>{plural(quote.lines.length, "line")}</strong>
                  </div>
                  <div>
                    <span>Valid until</span>
                    <strong>{formatDate(quote.validUntil)}</strong>
                  </div>
                  <div>
                    <span>Delivery estimate</span>
                    <strong>{quote.deliveryEstimate || "Not set"}</strong>
                  </div>
                  <div>
                    <span>Sent</span>
                    <strong>
                      {quote.sentAt ? formatDateTime(quote.sentAt) : "Not sent"}
                    </strong>
                  </div>
                  <div>
                    <span>Customer response</span>
                    <strong>
                      {quote.respondedAt
                        ? formatDateTime(quote.respondedAt)
                        : "No response yet"}
                    </strong>
                  </div>
                </div>
                {quote.note ? <p>{quote.note}</p> : null}

                <div className="admin-actions" style={{ marginTop: "1rem" }}>
                  <p>
                    Only the customer can accept or decline a quotation from
                    their account.
                  </p>

                  <button
                    type="button"
                    className="admin-btn quiet"
                    disabled={!canConvert}
                    onClick={convert}
                  >
                    Convert to order
                  </button>
                </div>

                {workflowHint ? (
                  <div
                    className={terminal ? "admin-notice" : "admin-note"}
                    style={{ marginTop: ".9rem" }}
                  >
                    {workflowHint}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
