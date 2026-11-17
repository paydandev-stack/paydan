"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";

type Ticket = {
  id: string;
  subject: string;
  email: string;
  status: string;
  assignee: string | null;
  updatedAt: string;
  messages: Array<{
    id: string;
    authorType: "customer" | "staff";
    body: string;
    createdAt: string;
  }>;
};

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setTickets(await api<Ticket[]>("/api/admin/support"));
  }, []);
  useEffect(() => {
    void load().catch((reason) => setError((reason as Error).message));
  }, [load]);
  async function update(id: string, status?: string) {
    setBusy(id);
    setError("");
    try {
      await api("/api/admin/support", {
        id,
        reply: reply[id]?.trim() || undefined,
        status,
      });
      setReply((current) => ({ ...current, [id]: "" }));
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Customer care"
        title="Support inbox"
        description="Append-only customer conversations with ownership-safe replies."
      />
      {error ? <p className="form-error">{error}</p> : null}
      {!tickets.length ? <p>No support conversations.</p> : null}
      <div className="operations-list">
        {tickets.map((ticket) => (
          <article key={ticket.id}>
            <h2>{ticket.subject}</h2>
            <p>
              {ticket.email} · {ticket.status.replaceAll("_", " ")} ·{" "}
              {ticket.assignee || "Unassigned"}
            </p>
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
            {ticket.status !== "resolved" ? (
              <>
                <label>
                  Reply
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
                  <button
                    disabled={busy === ticket.id || !reply[ticket.id]?.trim()}
                    onClick={() => void update(ticket.id)}
                  >
                    Send reply
                  </button>
                  <button
                    className="admin-btn quiet"
                    disabled={busy === ticket.id}
                    onClick={() => void update(ticket.id, "resolved")}
                  >
                    Resolve
                  </button>
                </div>
              </>
            ) : (
              <button
                className="admin-btn quiet"
                disabled={busy === ticket.id}
                onClick={() => void update(ticket.id, "open")}
              >
                Reopen
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
