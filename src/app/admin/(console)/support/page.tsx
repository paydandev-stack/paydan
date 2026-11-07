"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
type Ticket = {
  id: string;
  subject: string;
  message: string;
  email: string;
  status: string;
};
export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setTickets(await api<Ticket[]>("/api/admin/support"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function send(id: string) {
    setBusy(true);
    try {
      await api("/api/admin/support", { id, reply: reply[id] });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Support inbox</h1>
      <p role="status">{error}</p>
      {!tickets.length && <p>No support messages.</p>}
      <div className="operations-list">
        {tickets.map((t) => (
          <article key={t.id}>
            <h2>{t.subject}</h2>
            <p>
              {t.email} · {t.status}
            </p>
            <p>{t.message}</p>
            {t.status === "open" && (
              <>
                <label>
                  Reply
                  <textarea
                    value={reply[t.id] ?? ""}
                    onChange={(e) =>
                      setReply({ ...reply, [t.id]: e.target.value })
                    }
                  />
                </label>
                <button
                  disabled={busy || !reply[t.id]?.trim()}
                  onClick={() => void send(t.id)}
                >
                  Send email reply
                </button>
              </>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
