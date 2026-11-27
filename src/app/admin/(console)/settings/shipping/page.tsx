"use client";
import { useEffect, useState, type FormEvent } from "react";
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
  type DeliveryBand = {
    id:
      | "same_city"
      | "same_state"
      | "nearby_region"
      | "interstate"
      | "remote_area";
    label: string;
    fee: number;
    transitDaysMin: number;
    transitDaysMax: number;
    active: boolean;
  };
  const [bands, setBands] = useState<DeliveryBand[]>([]);
  const [bandForm, setBandForm] = useState<DeliveryBand>({
    id: "same_city",
    label: "Same city",
    fee: 0,
    transitDaysMin: 0,
    transitDaysMax: 1,
    active: true,
  });
  useEffect(() => {
    void api<DeliveryBand[]>("/api/admin/delivery-bands")
      .then(setBands)
      .catch((error) => setMessage((error as Error).message));
  }, []);
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
  async function saveBand(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/delivery-bands", bandForm);
      setBands(await api<DeliveryBand[]>("/api/admin/delivery-bands"));
      setMessage("Delivery band saved.");
    } catch (error) {
      setMessage((error as Error).message);
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
            <button
              type="button"
              className="admin-btn secondary"
              onClick={() => setForm(z)}
            >
              Edit zone
            </button>
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
        <button className="admin-btn primary" disabled={busy}>
          {busy ? "Saving…" : "Save zone"}
        </button>
      </form>
      <h2>Proximity delivery bands</h2>
      <p>
        When bands are active, checkout calculates one delivery fee for each
        vendor fulfilment location in the cart. Until then, the state zone fee
        above remains the fallback.
      </p>
      <div className="operations-list">
        {bands.map((band) => (
          <article key={band.id}>
            <strong>{band.label}</strong>
            <p>
              {money(band.fee)} · {band.transitDaysMin}–{band.transitDaysMax}{" "}
              transit days · {band.active ? "Active" : "Inactive"}
            </p>
            <button
              className="admin-btn secondary"
              type="button"
              onClick={() => setBandForm(band)}
            >
              Edit band
            </button>
          </article>
        ))}
      </div>
      <form className="operations-form" onSubmit={saveBand}>
        <label>
          Band
          <select
            value={bandForm.id}
            onChange={(event) => {
              const id = event.target.value as DeliveryBand["id"];
              setBandForm({
                ...bandForm,
                id,
                label: id
                  .replaceAll("_", " ")
                  .replace(/^./, (letter) => letter.toUpperCase()),
              });
            }}
          >
            <option value="same_city">Same city</option>
            <option value="same_state">Same state</option>
            <option value="nearby_region">Nearby region</option>
            <option value="interstate">Interstate</option>
            <option value="remote_area">Remote area</option>
          </select>
        </label>
        <label>
          Fee (NGN)
          <input
            type="number"
            min={0}
            step="0.01"
            value={bandForm.fee}
            onChange={(event) =>
              setBandForm({ ...bandForm, fee: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Minimum transit days
          <input
            type="number"
            min={0}
            value={bandForm.transitDaysMin}
            onChange={(event) =>
              setBandForm({
                ...bandForm,
                transitDaysMin: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          Maximum transit days
          <input
            type="number"
            min={0}
            value={bandForm.transitDaysMax}
            onChange={(event) =>
              setBandForm({
                ...bandForm,
                transitDaysMax: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={bandForm.active}
            onChange={(event) =>
              setBandForm({ ...bandForm, active: event.target.checked })
            }
          />{" "}
          Active
        </label>
        <button className="admin-btn primary" disabled={busy}>
          Save delivery band
        </button>
      </form>
    </>
  );
}
