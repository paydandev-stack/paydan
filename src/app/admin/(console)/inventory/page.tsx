"use client";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
export default function Inventory() {
  const { state } = useDemo();
  const [stock, setStock] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ product_id: string; variant_id: string; available: number }[]>(
      "/api/admin/inventory",
    )
      .then((rows) =>
        setStock(
          Object.fromEntries(
            rows.map((r) => [r.product_id + ":" + r.variant_id, r.available]),
          ),
        ),
      )
      .catch((e) => setMessage(e.message));
  }, []);
  async function save(productId: string, variantId: string) {
    setBusy(true);
    try {
      await api("/api/admin/inventory", {
        productId,
        variantId,
        available: stock[productId + ":" + variantId] ?? 0,
      });
      setMessage(
        "Available stock saved. Existing reservations are held separately.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Inventory</h1>
      <p>
        Set confirmed, unreserved units available for sale.
        Supplier-confirmation and preorder products remain blocked from
        checkout.
      </p>
      <p role="status">{message}</p>
      <div className="operations-list">
        {state.products.map((p) => (
          <article key={p.id}>
            <h2>{p.name}</h2>
            {p.variants.map((v) => (
              <div key={v.id}>
                <label>
                  {v.label}{" "}
                  <input
                    aria-label={`Available ${p.name} ${v.label}`}
                    type="number"
                    min={0}
                    max={1000000}
                    value={stock[p.id + ":" + v.id] ?? 0}
                    onChange={(e) =>
                      setStock({
                        ...stock,
                        [p.id + ":" + v.id]: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <button disabled={busy} onClick={() => void save(p.id, v.id)}>
                  Save stock
                </button>
              </div>
            ))}
          </article>
        ))}
      </div>
    </>
  );
}
