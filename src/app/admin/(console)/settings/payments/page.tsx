"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
export default function Payments() {
  const [services, setServices] = useState<Record<string, string | boolean>>(
    {},
  );
  const [error, setError] = useState("");
  useEffect(() => {
    void api<Record<string, string | boolean>>("/api/admin/services")
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
      <div className="operations-list">
        {Object.entries(services).map(([name, status]) => (
          <article key={name}>
            <strong>{name}</strong>
            <p>
              {typeof status === "boolean"
                ? status
                  ? "Configured"
                  : "Not configured"
                : status}
            </p>
          </article>
        ))}
      </div>
      <p>
        Configuration status does not verify connectivity. Complete test
        transactions, webhook delivery and refund verification before switching
        Paystack to live mode.
      </p>
    </>
  );
}
