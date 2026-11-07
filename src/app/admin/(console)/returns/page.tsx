"use client";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
type Refund = {
  id: string;
  return_id: string;
  amount_kobo: number;
  status: string;
  provider_id?: string;
};
export default function Returns() {
  const { state, refresh } = useDemo();
  const canRefund = ["Super Admin", "Order Manager"].includes(
    state.adminSession?.role ?? "",
  );
  const [note, setNote] = useState<Record<string, string>>({});
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    await refresh();
    if (canRefund) setRefunds(await api<Refund[]>("/api/admin/returns"));
  }
  useEffect(() => {
    void reload().catch((e) => setMessage(e.message));
  }, []);
  async function update(id: string, status: string) {
    setBusy(true);
    try {
      await api("/api/commands", {
        name: "updateReturn",
        args: [id, { status, adminNote: note[id] ?? "" }],
        key: crypto.randomUUID(),
      });
      await reload();
      setMessage("Return updated.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refund(id: string) {
    setBusy(true);
    try {
      const result = await api<{ message: string }>("/api/admin/returns", {
        returnId: id,
      });
      setMessage(result.message);
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Returns & refunds</h1>
      <p>
        Review each request. Approval alone does not issue a refund. Refunds use
        the original Paystack transaction and exclude delivery charges.
      </p>
      <p role="status">{message}</p>
      <div className="operations-list">
        {state.returns.length === 0 && <p>No return requests.</p>}
        {state.returns.map((r) => {
          const f = refunds.find((f) => f.return_id === r.id);
          return (
            <article key={r.id}>
              <h2>
                {r.reference} · {r.productName}
              </h2>
              <p>
                {r.quantity} items · {r.reason} · {r.status}
              </p>
              <p>{r.detail}</p>
              {r.images?.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  View attached image
                </a>
              ))}
              <label>
                Review notes
                <textarea
                  value={note[r.id] ?? r.adminNote}
                  onChange={(e) => setNote({ ...note, [r.id]: e.target.value })}
                />
              </label>
              {r.status !== "refunded" && (
                <div>
                  <button
                    disabled={busy}
                    onClick={() => void update(r.id, "under_review")}
                  >
                    Review
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void update(r.id, "approved")}
                  >
                    Approve return
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void update(r.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              )}
              {canRefund && r.status === "approved" && !f && (
                <button disabled={busy} onClick={() => void refund(r.id)}>
                  Issue approved item refund
                </button>
              )}
              {f && (
                <>
                  <p>
                    Refund: {f.status} · NGN{" "}
                    {(Number(f.amount_kobo) / 100).toFixed(2)}
                  </p>
                  {f.provider_id && (
                    <button
                      onClick={() =>
                        void api("/api/admin/returns", {
                          action: "verify",
                          providerId: f.provider_id,
                        })
                          .then(reload)
                          .catch((e) => setMessage(e.message))
                      }
                    >
                      Refresh Paystack status
                    </button>
                  )}
                  {!f.provider_id && (
                    <p>
                      Submission needs reconciliation in Paystack. Do not issue
                      another refund.
                    </p>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
