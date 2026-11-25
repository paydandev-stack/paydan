"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSearch, AdminSelect } from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";

type Ticket = {
  id: string;
  customerId: string;
  subject: string;
  email: string;
  status: string;
  assignee: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  unread: boolean;
  updatedAt: string;
  context: { orders: number; returns: number };
  internalNotes: Array<{
    id: string;
    body: string;
    author: string;
    at: string;
  }>;
  messages: Array<{
    id: string;
    authorType: "customer" | "staff";
    body: string;
    createdAt: string;
  }>;
};

type SupportPage = {
  tickets: Ticket[];
  nextCursor: string | null;
  cannedReplies: Array<{ id: string; label: string; body: string }>;
};

export default function Support() {
  const { state } = useDemo();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [canned, setCanned] = useState<SupportPage["cannedReplies"]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(
    async (next?: string, append = false) => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status !== "all") params.set("status", status);
      if (assignee !== "all") params.set("assignee", assignee);
      if (priority !== "all") params.set("priority", priority);
      if (next) params.set("cursor", next);
      const page = await api<SupportPage>("/api/admin/support?" + params);
      setTickets((current) =>
        append ? [...current, ...page.tickets] : page.tickets,
      );
      setCursor(page.nextCursor);
      setCanned(page.cannedReplies);
    },
    [assignee, priority, query, status],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError((reason as Error).message));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function update(
    id: string,
    patch: Record<string, unknown>,
    clear?: "reply" | "note",
  ) {
    setBusy(id);
    setError("");
    try {
      await api("/api/admin/support", { id, ...patch });
      if (clear === "reply") setReply((current) => ({ ...current, [id]: "" }));
      if (clear === "note") setNote((current) => ({ ...current, [id]: "" }));
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy("");
    }
  }

  const staff = state.team
    .filter((member) => member.role !== "Vendor" && member.status === "active")
    .map((member) => ({ value: member.email, label: member.name }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Customer care"
        title="Support inbox"
        description="Search, prioritize, claim and resolve customer conversations with private notes and order context."
      />
      <div className="admin-filters">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search subject or email"
          label="Search support"
        />
        <AdminSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "open", label: "Open" },
            { value: "waiting_on_staff", label: "Waiting on staff" },
            { value: "waiting_on_customer", label: "Waiting on customer" },
            { value: "resolved", label: "Resolved" },
          ]}
        />
        <AdminSelect
          label="Assignee"
          value={assignee}
          onChange={setAssignee}
          options={[
            { value: "all", label: "Any assignee" },
            { value: "unassigned", label: "Unassigned" },
            ...staff,
          ]}
        />
        <AdminSelect
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={[
            { value: "all", label: "All priorities" },
            ...["low", "normal", "high", "urgent"].map((value) => ({
              value,
              label: value[0].toUpperCase() + value.slice(1),
            })),
          ]}
        />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {!tickets.length ? (
        <p>No support conversations match these filters.</p>
      ) : null}
      <div className="operations-list">
        {tickets.map((ticket) => {
          const ageHours = Math.max(
            0,
            Math.floor((Date.now() - Date.parse(ticket.updatedAt)) / 3_600_000),
          );
          const late =
            ticket.status !== "resolved" &&
            ageHours >= (ticket.priority === "urgent" ? 1 : 8);
          return (
            <article key={ticket.id}>
              <div className="admin-section-card-header">
                <div>
                  <h2>
                    {ticket.unread ? "● " : ""}
                    {ticket.subject}
                  </h2>
                  <p>
                    {ticket.email} · {ticket.status.replaceAll("_", " ")} ·{" "}
                    {ticket.assignee || "Unassigned"}
                  </p>
                </div>
                <div className="admin-actions">
                  <StatusPill
                    tone={
                      ticket.priority === "urgent"
                        ? "red"
                        : ticket.priority === "high"
                          ? "orange"
                          : "blue"
                    }
                  >
                    {ticket.priority}
                  </StatusPill>
                  <StatusPill tone={late ? "red" : "green"}>
                    {late
                      ? "SLA late · " + ageHours + "h"
                      : "SLA · " + ageHours + "h"}
                  </StatusPill>
                </div>
              </div>
              <p>
                Customer context: {ticket.context.orders} orders ·{" "}
                {ticket.context.returns} returns ·{" "}
                <a href={"/admin/customers/" + ticket.customerId}>
                  Open profile
                </a>
              </p>
              <div className="admin-actions">
                <button
                  className="admin-btn secondary"
                  disabled={busy === ticket.id}
                  onClick={() =>
                    void update(ticket.id, { claim: true, read: true })
                  }
                >
                  Claim
                </button>
                {ticket.unread ? (
                  <button
                    className="admin-btn quiet"
                    disabled={busy === ticket.id}
                    onClick={() => void update(ticket.id, { read: true })}
                  >
                    Mark read
                  </button>
                ) : null}
                <select
                  className="admin-select"
                  aria-label={"Reassign " + ticket.subject}
                  value={ticket.assignee ?? ""}
                  disabled={busy === ticket.id}
                  onChange={(event) =>
                    void update(ticket.id, { assignee: event.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {staff.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="admin-select"
                  aria-label={"Priority for " + ticket.subject}
                  value={ticket.priority}
                  disabled={busy === ticket.id}
                  onChange={(event) =>
                    void update(ticket.id, { priority: event.target.value })
                  }
                >
                  {["low", "normal", "high", "urgent"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              {ticket.messages.map((message) => (
                <div className="queue-item" key={message.id}>
                  <span>
                    <strong>
                      {message.authorType === "staff" ? "PAYDAN" : "Customer"}
                    </strong>
                    <br />
                    {message.body}
                  </span>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
              ))}
              {ticket.internalNotes.length ? (
                <details>
                  <summary>
                    {ticket.internalNotes.length} private team note
                    {ticket.internalNotes.length === 1 ? "" : "s"}
                  </summary>
                  {ticket.internalNotes.map((item) => (
                    <div className="admin-note" key={item.id}>
                      <strong>{item.author}</strong> · {formatDateTime(item.at)}
                      <p>{item.body}</p>
                    </div>
                  ))}
                </details>
              ) : null}
              <label className="admin-field wide">
                Customer reply
                <textarea
                  value={reply[ticket.id] ?? ""}
                  onChange={(event) =>
                    setReply((current) => ({
                      ...current,
                      [ticket.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="admin-actions">
                <select
                  className="admin-select"
                  defaultValue=""
                  aria-label="Insert canned response"
                  onChange={(event) => {
                    const item = canned.find(
                      (entry) => entry.id === event.target.value,
                    );
                    if (item)
                      setReply((current) => ({
                        ...current,
                        [ticket.id]: item.body,
                      }));
                    event.target.value = "";
                  }}
                >
                  <option value="">Use canned response…</option>
                  {canned.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <button
                  className="admin-btn primary"
                  disabled={busy === ticket.id || !reply[ticket.id]?.trim()}
                  onClick={() =>
                    void update(
                      ticket.id,
                      { reply: reply[ticket.id]?.trim(), read: true },
                      "reply",
                    )
                  }
                >
                  Send reply
                </button>
                <button
                  className="admin-btn quiet"
                  disabled={busy === ticket.id}
                  onClick={() =>
                    void update(ticket.id, {
                      status:
                        ticket.status === "resolved" ? "open" : "resolved",
                    })
                  }
                >
                  {ticket.status === "resolved" ? "Reopen" : "Resolve"}
                </button>
              </div>
              <label className="admin-field wide">
                Private team note
                <textarea
                  value={note[ticket.id] ?? ""}
                  onChange={(event) =>
                    setNote((current) => ({
                      ...current,
                      [ticket.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                className="admin-btn secondary"
                disabled={busy === ticket.id || !note[ticket.id]?.trim()}
                onClick={() =>
                  void update(
                    ticket.id,
                    { internalNote: note[ticket.id]?.trim() },
                    "note",
                  )
                }
              >
                Add private note
              </button>
            </article>
          );
        })}
      </div>
      {cursor ? (
        <div className="admin-actions" style={{ justifyContent: "center" }}>
          <button
            className="admin-btn secondary"
            onClick={() => void load(cursor, true)}
          >
            Load older conversations
          </button>
        </div>
      ) : null}
    </>
  );
}
