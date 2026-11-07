"use client";
import { useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { nigerianStates } from "@/lib/catalog";
const emptyForm = {
  label: "Home",
  recipient: "",
  phone: "",
  street: "",
  landmark: "",
  city: "",
  state: "Lagos",
};
export default function AccountAddressesPage() {
  const { state, actions } = useDemo();
  const session = state.customerSession;
  const [form, setForm] = useState(emptyForm);
  if (!session) return null;
  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      if (!form.recipient.trim() || !form.street.trim() || !form.city.trim())
        return;
      await actions.addAddress({
        label: form.label.trim() || "Address",
        recipient: form.recipient.trim(),
        phone: form.phone.trim(),
        street: form.street.trim(),
        landmark: form.landmark.trim() || undefined,
        city: form.city.trim(),
        state: form.state,
        isDefault: state.addresses.length === 0,
      });
      setForm(emptyForm);
    } catch (error) {}
  }
  return (
    <>
      <h1>Delivery addresses</h1>
      <p style={{ color: "var(--muted)", fontSize: ".75rem" }}>
        Saved addresses are reused at checkout. One address can be marked as the
        default.
      </p>

      <div className="address-grid">
        {state.addresses.map((address) => (
          <article
            key={address.id}
            className={`address-card${address.isDefault ? " default" : ""}`}
          >
            <header>
              <strong>{address.label}</strong>
              {address.isDefault ? (
                <span className="status green">Default</span>
              ) : null}
            </header>
            <p>
              {address.recipient}
              <br />
              {address.street}
              {address.landmark ? `, ${address.landmark}` : ""}
              <br />
              {address.city}, {address.state}
              <br />
              {address.phone}
            </p>
            <div className="address-actions">
              {address.isDefault ? null : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      return await actions.setDefaultAddress(address.id);
                    } catch (error) {}
                  }}
                >
                  Make default
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    return await actions.removeAddress(address.id);
                  } catch (error) {}
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      <h2>Add an address</h2>
      <form className="checkout-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Label
            <input
              value={form.label}
              onChange={(event) => update("label", event.target.value)}
            />
          </label>
          <label>
            Recipient name
            <input
              value={form.recipient}
              onChange={(event) => update("recipient", event.target.value)}
            />
          </label>
          <label>
            Phone number
            <input
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </label>
          <label>
            City
            <input
              value={form.city}
              onChange={(event) => update("city", event.target.value)}
            />
          </label>
          <label className="wide">
            State
            <select
              value={form.state}
              onChange={(event) => update("state", event.target.value)}
            >
              {nigerianStates.map((stateName) => (
                <option key={stateName} value={stateName}>
                  {stateName}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Street address
            <input
              value={form.street}
              onChange={(event) => update("street", event.target.value)}
            />
          </label>
          <label className="wide">
            Landmark (optional)
            <input
              value={form.landmark}
              onChange={(event) => update("landmark", event.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary">
            Save address
          </button>
        </div>
      </form>
    </>
  );
}
