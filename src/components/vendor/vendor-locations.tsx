"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import type { VendorFulfillmentLocation } from "@/lib/types";

export function VendorLocations({
  vendorId,
  initial,
}: {
  vendorId: string;
  initial: VendorFulfillmentLocation[];
}) {
  const [locations, setLocations] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function patch(id: string, value: Partial<VendorFulfillmentLocation>) {
    setLocations((current) =>
      current.map((location) =>
        location.id === id ? { ...location, ...value } : location,
      ),
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/commands", {
        name: "saveVendorLocations",
        args: [locations],
        key: crypto.randomUUID(),
      });
      setMessage("Fulfilment locations saved.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="vendor-panel vendor-edit-form" onSubmit={submit}>
      <div className="vendor-panel-head">
        <div>
          <h2>Fulfilment locations</h2>
          <p>Manage the warehouses PAYDAN can use for stock and delivery.</p>
        </div>
        <button
          className="vendor-primary"
          type="button"
          onClick={() =>
            setLocations((current) => [
              ...current,
              {
                id: `${vendorId}-${crypto.randomUUID()}`,
                vendorId,
                label: "New location",
                address: "",
                city: "",
                state: "Lagos",
                isPrimary: false,
                active: true,
                pickupAvailable: false,
                dispatchLeadTimeDays: 1,
              },
            ])
          }
        >
          Add location
        </button>
      </div>
      {locations.map((location) => (
        <fieldset className="vendor-fields" key={location.id}>
          <label>
            Location label
            <input
              value={location.label}
              onChange={(event) =>
                patch(location.id, { label: event.target.value })
              }
            />
          </label>
          <label>
            City
            <input
              value={location.city}
              onChange={(event) =>
                patch(location.id, { city: event.target.value })
              }
            />
          </label>
          <label>
            State
            <input
              value={location.state}
              onChange={(event) =>
                patch(location.id, { state: event.target.value })
              }
            />
          </label>
          <label>
            Dispatch lead time (days)
            <input
              type="number"
              min={0}
              max={365}
              value={location.dispatchLeadTimeDays}
              onChange={(event) =>
                patch(location.id, {
                  dispatchLeadTimeDays: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="wide">
            Warehouse address (private)
            <input
              value={location.address}
              onChange={(event) =>
                patch(location.id, { address: event.target.value })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={location.isPrimary}
              onChange={(event) =>
                setLocations((current) =>
                  current.map((item) => ({
                    ...item,
                    isPrimary:
                      item.id === location.id
                        ? event.target.checked
                        : event.target.checked
                          ? false
                          : item.isPrimary,
                  })),
                )
              }
            />{" "}
            Primary
          </label>
          <label>
            <input
              type="checkbox"
              checked={location.pickupAvailable}
              onChange={(event) =>
                patch(location.id, { pickupAvailable: event.target.checked })
              }
            />{" "}
            Pickup available
          </label>
          <label>
            <input
              type="checkbox"
              checked={location.active}
              onChange={(event) =>
                patch(location.id, { active: event.target.checked })
              }
            />{" "}
            Active
          </label>
          {!location.isPrimary ? (
            <button
              type="button"
              onClick={() =>
                setLocations((current) =>
                  current.filter((item) => item.id !== location.id),
                )
              }
            >
              Remove
            </button>
          ) : null}
        </fieldset>
      ))}
      {message ? <p role="status">{message}</p> : null}
      <div className="vendor-form-actions">
        <button type="submit" disabled={busy || !locations.length}>
          {busy ? "Saving…" : "Save locations"}
        </button>
      </div>
    </form>
  );
}
