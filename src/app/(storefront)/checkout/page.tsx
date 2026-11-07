"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
import { nigerianStates } from "@/lib/catalog";
import { money } from "@/lib/format";
type Quote = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  eta: string;
};
export default function Checkout() {
  const { state, hydrated } = useDemo();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const key = useRef("");
  const [sourceId, setSourceId] = useState("");
  useEffect(() => {
    setSourceId(new URLSearchParams(location.search).get("order") ?? "");
  }, []);
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    address: {
      label: "Home",
      recipient: "",
      phone: "",
      street: "",
      landmark: "",
      city: "",
      state: "Lagos",
    },
    notes: "",
    saveAddress: true,
    voucherCode: "",
  });
  const initialized = useRef(false);
  useEffect(() => {
    if (!hydrated || !state.customerSession || initialized.current) return;
    initialized.current = true;
    const address =
      state.addresses.find((a) => a.isDefault) ?? state.addresses[0];
    setForm((f) => ({
      ...f,
      customerName: state.customerSession!.name,
      email: state.customerSession!.email,
      phone: address?.phone ?? "",
      address: address
        ? {
            label: address.label,
            recipient: address.recipient,
            phone: address.phone,
            street: address.street,
            landmark: address.landmark ?? "",
            city: address.city,
            state: address.state,
          }
        : { ...f.address, recipient: state.customerSession!.name },
    }));
    key.current =
      sessionStorage.getItem("paydan-checkout-key") || crypto.randomUUID();
    sessionStorage.setItem("paydan-checkout-key", key.current);
  }, [hydrated, state.customerSession, state.addresses]);
  if (!hydrated)
    return (
      <div className="wrap dashboard" aria-busy="true">
        Opening checkout…
      </div>
    );
  if (!state.customerSession)
    return (
      <div className="payment-state">
        <h1>Sign in to checkout</h1>
        <p>Your personal dashboard is the starting point for purchasing.</p>
        <Link className="primary" href="/login?next=%2Fcheckout">
          Sign in
        </Link>
      </div>
    );
  const lines = state.cart.flatMap((line) => {
    const p = state.products.find((p) => p.id === line.productId);
    const v = p?.variants.find((v) => v.id === line.variantId);
    return p && v ? [{ line, p, v }] : [];
  });
  const sourced = sourceId
    ? state.orders.find((o) => o.id === sourceId)
    : undefined;
  if (sourced) {
    lines.splice(
      0,
      lines.length,
      ...sourced.items.map((item, i) => ({
        line: {
          productId: item.productId,
          variantId: String(i),
          quantity: item.quantity,
        },
        p: {
          id: item.productId,
          name: item.name,
        } as (typeof state.products)[number],
        v: {
          id: String(i),
          label: item.variantLabel,
          price: item.unitPrice,
        } as (typeof state.products)[number]["variants"][number],
      })),
    );
  }
  if (sourceId && !sourced)
    return (
      <div className="payment-state">
        <h1>Order not found</h1>
        <Link href="/account/orders">View your orders</Link>
      </div>
    );
  if (!lines.length)
    return (
      <div className="payment-state">
        <h1>Your cart is empty</h1>
        <p>Explore the departments to find your next favourite.</p>
        <Link href="/dashboard">Back to your dashboard</Link>
      </div>
    );
  async function review(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setQuote(
        await api<Quote>("/api/checkout", {
          action: "quote",
          input: { ...form, orderId: sourceId || undefined },
        }),
      );
      setStep(2);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to calculate your total.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (busy || !quote) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        url?: string;
        orderId: string;
        status?: string;
      }>("/api/checkout", {
        action: "initialize",
        input: {
          ...form,
          orderId: sourceId || undefined,
          expectedTotal: quote.total,
        },
        key: key.current,
      });
      if (result.url) location.assign(result.url);
      else location.assign(`/checkout/success?order=${result.orderId}`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to start payment.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="wrap dashboard">
      <div className="checkout-top">
        <div>
          <h1>Checkout</h1>
          <p>Delivery details → Review your order → Pay securely</p>
        </div>
      </div>
      <div className="checkout-layout">
        <section className="checkout-card">
          {step === 1 ? (
            <form onSubmit={review}>
              <h2>Contact & delivery</h2>
              {state.addresses.length > 0 && (
                <label>
                  Use a saved address
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const a = state.addresses.find(
                        (a) => a.id === e.target.value,
                      );
                      if (a)
                        setForm({
                          ...form,
                          address: {
                            label: a.label,
                            recipient: a.recipient,
                            phone: a.phone,
                            street: a.street,
                            landmark: a.landmark ?? "",
                            city: a.city,
                            state: a.state,
                          },
                          phone: a.phone,
                        });
                    }}
                  >
                    <option value="">Choose an address</option>
                    {state.addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} — {a.city}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="form-grid">
                {(
                  [
                    ["customerName", "Full name"],
                    ["phone", "Contact phone"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input
                      required
                      maxLength={200}
                      value={form[field]}
                      onChange={(e) =>
                        setForm({ ...form, [field]: e.target.value })
                      }
                    />
                  </label>
                ))}
                {(
                  [
                    ["recipient", "Recipient name"],
                    ["phone", "Recipient phone"],
                    ["street", "Street address"],
                    ["city", "City"],
                    ["landmark", "Landmark (optional)"],
                  ] as const
                ).map(([field, label]) => (
                  <label
                    key={field}
                    className={field === "street" ? "wide" : undefined}
                  >
                    {label}
                    <input
                      required={field !== "landmark"}
                      maxLength={200}
                      value={form.address[field]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          address: { ...form.address, [field]: e.target.value },
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  State
                  <select
                    value={form.address.state}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: { ...form.address, state: e.target.value },
                      })
                    }
                  >
                    {nigerianStates.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Promotion code (optional)
                  <input
                    value={form.voucherCode}
                    maxLength={40}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        voucherCode: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
                <label className="wide">
                  Delivery notes (optional)
                  <textarea
                    value={form.notes}
                    maxLength={2000}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={form.saveAddress}
                  onChange={(e) =>
                    setForm({ ...form, saveAddress: e.target.checked })
                  }
                />{" "}
                Save this address
              </label>
              <div className="form-actions">
                <Link href="/cart">Back to cart</Link>
                <button className="primary" disabled={busy}>
                  {busy ? "Calculating…" : "Review order"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <h2>Review your order</h2>
              <p>
                {form.address.recipient} · {form.address.phone}
              </p>
              <p>
                {form.address.street}, {form.address.city}, {form.address.state}
              </p>
              <p>Delivery estimate: {quote?.eta}</p>
              <div className="review-notice">
                <strong>Secure payment with Paystack</strong>
                <p>
                  Continue to Paystack to choose an available payment method.
                  PAYDAN verifies your payment before processing the order.
                </p>
              </div>
              {lines.map(({ line, p, v }) => (
                <div className="review-line" key={v.id}>
                  <span>
                    {p.name} · {v.label} × {line.quantity}
                  </span>
                  <strong>{money(v.price * line.quantity)}</strong>
                </div>
              ))}
              <div className="form-actions">
                <button onClick={() => setStep(1)} disabled={busy}>
                  Edit details
                </button>
                <button className="primary" onClick={pay} disabled={busy}>
                  {busy ? "Opening Paystack…" : `Pay ${money(quote!.total)}`}
                </button>
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error} <Link href="/account/orders">View orders</Link>
            </p>
          )}
        </section>
        <aside className="order-summary">
          <h2>Order summary</h2>
          {lines.map(({ line, p, v }) => (
            <div key={v.id}>
              <span>
                {p.name} × {line.quantity}
              </span>
              <strong>{money(v.price * line.quantity)}</strong>
            </div>
          ))}
          {quote ? (
            <>
              <hr />
              <div>
                <span>Subtotal</span>
                <strong>{money(quote.subtotal)}</strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>{money(quote.deliveryFee)}</strong>
              </div>
              <div>
                <span>Promotion</span>
                <strong>−{money(quote.discount)}</strong>
              </div>
              <div className="total">
                <span>Total</span>
                <strong>{money(quote.total)}</strong>
              </div>
            </>
          ) : (
            <p>
              Enter your delivery details to confirm the total. Products
              awaiting supplier confirmation require a sourcing request before
              payment.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
