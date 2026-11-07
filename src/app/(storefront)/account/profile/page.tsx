"use client";
import Link from "next/link";
import { LinkGoogle } from "@/components/link-google";
import { useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { nigerianStates } from "@/lib/catalog";

export default function AccountProfilePage() {
  const { state, actions } = useDemo();
  const session = state.customerSession;
  const customer = state.customers.find((item) => item.id === session?.id);
  const initialForm = {
    name: customer?.name ?? session?.name ?? "",
    email: customer?.email ?? session?.email ?? "",
    phone: customer?.phone ?? "",
    city: customer?.city ?? "",
    state: customer?.state ?? "Lagos",
  };
  const [form, setForm] = useState(initialForm);
  const [savedForm, setSavedForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!session) return null;

  const dirty = Object.keys(form).some(
    (key) =>
      form[key as keyof typeof form] !== savedForm[key as keyof typeof form],
  );
  const profileInitials = form.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await actions.updateCustomer(session!.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        state: form.state,
      });
      const saved = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
      };
      setForm(saved);
      setSavedForm(saved);
      setMessage("Your profile has been updated.");
      actions.notify("Profile updated");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to update profile.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-page">
      <header className="profile-hero">
        <span className="profile-avatar" aria-hidden="true">
          {profileInitials || "P"}
        </span>
        <div>
          <span className="kicker green">YOUR ACCOUNT</span>
          <h1>Profile</h1>
          <p>
            Keep your personal and delivery details accurate across your PAYDAN
            account.
          </p>
        </div>
      </header>

      <div className="profile-layout">
        <form
          className="profile-card profile-details-card"
          onSubmit={handleSubmit}
        >
          <div className="profile-card-heading">
            <div>
              <span>PERSONAL INFORMATION</span>
              <h2>Your details</h2>
            </div>
            <p>Saved securely to your account and used during checkout.</p>
          </div>

          <div className="form-grid">
            <label>
              Full name
              <input
                required
                autoComplete="name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                readOnly
                value={form.email}
                aria-describedby="profile-email-note"
              />
              <small id="profile-email-note">
                Your verified sign-in email cannot be changed here.
              </small>
            </label>
            <label>
              Phone number
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </label>
            <label>
              City
              <input
                autoComplete="address-level2"
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
              />
            </label>
            <label className="wide">
              State
              <select
                autoComplete="address-level1"
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
          </div>

          <div className="profile-form-footer">
            <div className="profile-form-status" aria-live="polite">
              {error ? <span className="error">{error}</span> : null}
              {message ? <span className="success">{message}</span> : null}
              {!error && !message && dirty ? (
                <span>Unsaved changes</span>
              ) : null}
            </div>
            <button type="submit" className="primary" disabled={busy || !dirty}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <section className="profile-card profile-security-card">
          <div className="profile-card-heading">
            <div>
              <span>SECURITY &amp; SIGN-IN</span>
              <h2>Access methods</h2>
            </div>
            <p>Manage the secure ways you can get back into your account.</p>
          </div>

          <div className="security-options">
            <LinkGoogle />
            <div className="security-option">
              <span className="security-option-icon" aria-hidden="true">
                ••
              </span>
              <div className="security-option-copy">
                <h3>Password</h3>
                <p>We will email you a secure link to choose a new password.</p>
              </div>
              <Link className="security-action" href="/forgot-password">
                Change password
              </Link>
            </div>
          </div>

          <p className="profile-security-note">
            Accounts are never joined automatically just because their email
            addresses match.
          </p>
        </section>
      </div>
    </div>
  );
}
