"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
export default function Payments() {
  const [services, setServices] = useState<
    Record<
      string,
      { status: string; checkedAt?: string; mode?: string; message?: string }
    >
  >({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<
      Record<
        string,
        { status: string; checkedAt?: string; mode?: string; message?: string }
      >
    >("/api/admin/services")
      .then(setServices)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <h1>Payments & connected services</h1>
      <p>
        Paystack is the only payment gateway. Keys are managed in the server
        environment and are never shown here.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="admin-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setServices(await api("/api/admin/services", { action: "verify" }));
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : "Run safe connectivity checks"}
      </button>
      <div className="operations-list">
        {Object.entries(services).map(([name, status]) => (
          <article key={name}>
            <strong>{name}</strong>
            <p>
              {status.status.replaceAll("_", " ")}
              {status.mode ? ` · ${status.mode}` : ""}
            </p>
            {status.checkedAt ? (
              <small>
                Checked {new Date(status.checkedAt).toLocaleString()}
              </small>
            ) : null}
            {status.message ? <small>{status.message}</small> : null}
          </article>
        ))}
      </div>
      <p>
        Connectivity checks are side-effect free. Complete real OAuth,
        transaction, webhook, email-delivery and refund acceptance tests before
        switching Paystack to live mode.
      </p>
    </>
  );
}
