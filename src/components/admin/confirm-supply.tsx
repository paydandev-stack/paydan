"use client";
import { useState } from "react";
import type { Order } from "@/lib/types";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
export function ConfirmSupply({ order }: { order: Order }) {
  const { state, refresh } = useDemo();
  const [vendor, setVendor] = useState("");
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await api("/api/admin/sourced-supply", {
        orderId: order.id,
        vendorId: vendor,
        costs: order.items.map((item) => ({
          productId: item.productId,
          costPrice: Number(costs[item.productId]),
        })),
        confirmed: true,
      });
      await refresh();
      setMessage(
        "Supplier confirmed. The customer can now enter delivery details and pay.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (
    !["Super Admin", "Procurement Manager"].includes(
      state.adminSession?.role ?? "",
    ) ||
    !state.sourcing.some((request) => request.convertedOrderId === order.id) ||
    order.paymentStatus !== "pending"
  )
    return null;
  return (
    <section className="admin-panel">
      <h2>Confirm sourced supply before payment</h2>
      <p>
        Confirm availability directly with the supplier, then record their
        actual item costs.
      </p>
      <div className="operations-form">
        <label>
          Supplier
          <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="">Choose supplier</option>
            {state.vendors
              .filter((v) => v.status === "active")
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </label>
        {order.items.map((item) => (
          <label key={item.productId}>
            {item.name} · unit cost (NGN)
            <input
              type="number"
              min={0}
              step="0.01"
              value={costs[item.productId] ?? ""}
              onChange={(e) =>
                setCosts({ ...costs, [item.productId]: e.target.value })
              }
            />
          </label>
        ))}
        <button
          className="admin-btn"
          disabled={
            busy ||
            !vendor ||
            order.items.some((item) => !costs[item.productId])
          }
          onClick={() => void confirm()}
        >
          Confirm supplier availability
        </button>
        <p role="status">{message}</p>
      </div>
    </section>
  );
}
