"use client";
import { useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
import { nigerianStates } from "@/lib/catalog";
import { money } from "@/lib/format";
export default function Shipping() {
  const { state, refresh } = useDemo();
  const [form, setForm] = useState({
    id: "",
    state: "Lagos",
    fee: 0,
    eta: "",
    active: true,
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/commands", {
        name: "saveShippingZone",
        args: [{ ...form, id: form.state.toLowerCase().replaceAll(" ", "-") }],
        key: crypto.randomUUID(),
      });
      await refresh();
      setMessage("Delivery zone saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Delivery zones</h1>
      <p>
        Checkout uses active zones only. An unsupported location requires a
        delivery quotation before payment.
      </p>
      <div className="operations-list">
        {state.shippingZones.map((z) => (
          <article key={z.id}>
            <strong>{z.state}</strong>
            <p>
              {money(z.fee)} · {z.eta} · {z.active ? "Active" : "Inactive"}
            </p>
            <button onClick={() => setForm(z)}>Edit zone</button>
          </article>
        ))}
      </div>
      <h2>Add or update a zone</h2>
      <form className="operations-form" onSubmit={submit}>
        <label>
          State
          <select
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          >
            {nigerianStates.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Fee (NGN)
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={form.fee}
            onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
          />
        </label>
        <label>
          Delivery estimate
          <input
            required
            value={form.eta}
            onChange={(e) => setForm({ ...form, eta: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />{" "}
          Active
        </label>
        <p role="status">{message}</p>
        <button className="admin-btn" disabled={busy}>
          Save zone
        </button>
      </form>
    </>
  );
}
