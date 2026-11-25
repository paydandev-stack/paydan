"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTextArea, AdminTextField } from "@/components/admin/data-table";
type StorefrontForm = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  businessHours: string;
  announcement: string;
  orderNotificationEmail: string;
  supportNotificationEmail: string;
};
function formFromSettings(settings: {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  businessHours: string;
  announcement: string;
  orderNotificationEmail?: string;
  supportNotificationEmail?: string;
}): StorefrontForm {
  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    businessHours: settings.businessHours,
    announcement: settings.announcement,
    orderNotificationEmail: settings.orderNotificationEmail ?? "",
    supportNotificationEmail: settings.supportNotificationEmail ?? "",
  };
}
/**
 * Storefront identity and contact details. A single save writes the whole form
 * through updateSettings; the announcement preview mirrors the storefront
 * header strip, which renders the raw announcement text.
 */
export default function AdminStorefrontSettingsPage() {
  const { state, actions } = useDemo();
  const settings = state.settings;
  const [form, setForm] = useState<StorefrontForm>(() =>
    formFromSettings(settings),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Keep the draft in step with settings coming from outside this form
  // (another screen, or "reset demonstration data").
  useEffect(() => {
    setForm(formFromSettings(settings));
  }, [settings]);
  const dirty =
    form.storeName !== settings.storeName ||
    form.supportEmail !== settings.supportEmail ||
    form.supportPhone !== settings.supportPhone ||
    form.businessHours !== settings.businessHours ||
    form.announcement !== settings.announcement ||
    form.orderNotificationEmail !== (settings.orderNotificationEmail ?? "") ||
    form.supportNotificationEmail !== (settings.supportNotificationEmail ?? "");
  function update<K extends keyof StorefrontForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function handleSave(event: React.FormEvent) {
    try {
      event.preventDefault();
      if (saving) return;
      if (!form.storeName.trim()) {
        setError("The store name cannot be empty.");
        return;
      }
      if (!form.supportEmail.includes("@")) {
        setError("Enter a valid support email address.");
        return;
      }
      if (!/^\+?[0-9 ()-]{7,25}$/.test(form.supportPhone.trim())) {
        setError("Enter a valid support phone number.");
        return;
      }
      for (const value of [
        form.orderNotificationEmail,
        form.supportNotificationEmail,
      ])
        if (value && !value.includes("@")) {
          setError("Enter valid operational notification email addresses.");
          return;
        }
      setSaving(true);
      await actions.updateSettings({
        storeName: form.storeName.trim(),
        supportEmail: form.supportEmail.trim(),
        supportPhone: form.supportPhone.trim(),
        businessHours: form.businessHours.trim(),
        announcement: form.announcement.trim(),
        orderNotificationEmail: form.orderNotificationEmail.trim(),
        supportNotificationEmail: form.supportNotificationEmail.trim(),
      });
      actions.notify("Storefront settings saved");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save storefront settings.",
      );
    } finally {
      setSaving(false);
    }
  }
  function handleDiscard() {
    setForm(formFromSettings(settings));
    setError("");
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Settings · Storefront"
        title="Storefront"
        description={`${settings.storeName} · announcement, support contact and business hours · stored centrally in PostgreSQL`}
        action={
          <Link className="admin-btn quiet" href="/admin/settings">
            All settings
          </Link>
        }
      />

      <div className="admin-panels" style={{ alignItems: "start" }}>
        <section className="admin-card">
          <h2>Store details</h2>
          <p>
            Shown across the storefront footer, help pages and checkout contact
            prompts.
          </p>

          <form onSubmit={handleSave} noValidate>
            <div className="form-grid" style={{ marginTop: "1rem" }}>
              <AdminTextField
                label="Store name"
                value={form.storeName}
                onChange={(event) => update("storeName", event.target.value)}
              />
              <AdminTextField
                label="Support email"
                type="email"
                value={form.supportEmail}
                onChange={(event) => update("supportEmail", event.target.value)}
              />
              <AdminTextField
                label="Support phone"
                type="tel"
                value={form.supportPhone}
                onChange={(event) => update("supportPhone", event.target.value)}
              />
              <AdminTextField
                label="Business hours"
                value={form.businessHours}
                onChange={(event) =>
                  update("businessHours", event.target.value)
                }
              />
              <AdminTextField
                label="Currency"
                value={settings.currency}
                readOnly
                hint="Display currency is NGN. Payment calculations use integer kobo."
              />
              <AdminTextArea
                label="Header announcement"
                wide
                rows={3}
                value={form.announcement}
                onChange={(event) => update("announcement", event.target.value)}
                hint="Rendered as plain text in the dark strip above the storefront navigation."
              />
              <AdminTextField
                label="Order operations email"
                type="email"
                value={form.orderNotificationEmail}
                onChange={(event) =>
                  update("orderNotificationEmail", event.target.value)
                }
                hint="Receives internal order, payment, sourcing and return alerts. Not exposed publicly."
              />
              <AdminTextField
                label="Support operations email"
                type="email"
                value={form.supportNotificationEmail}
                onChange={(event) =>
                  update("supportNotificationEmail", event.target.value)
                }
                hint="Receives new support-thread alerts. Not exposed publicly."
              />
            </div>

            {error ? (
              <div
                className="admin-note"
                style={{ marginTop: ".8rem" }}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div className="form-actions">
              <button
                type="button"
                className="admin-btn quiet"
                onClick={handleDiscard}
                disabled={!dirty || saving}
              >
                Discard changes
              </button>
              <button
                type="submit"
                className="admin-btn primary"
                disabled={!dirty || saving}
              >
                {saving
                  ? "Saving…"
                  : dirty
                    ? "Save storefront settings"
                    : "No changes to save"}
              </button>
            </div>
          </form>

          <p>These settings are saved centrally and used by the storefront.</p>
        </section>

        <section className="admin-card">
          <h2>Announcement preview</h2>
          <p>
            The storefront header prints the announcement verbatim in the top
            utility strip. This preview updates as you type; save to apply it to
            the live header.
          </p>

          <div
            aria-label="Preview of the storefront announcement strip"
            style={{
              marginTop: "1rem",
              padding: ".55rem .8rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              borderRadius: ".4rem",
              background: "var(--green-deep)",
              color: "white",
              fontSize: ".72rem",
              fontWeight: 600,
              letterSpacing: ".015em",
            }}
          >
            <span>
              {form.announcement.trim() === "" ? "…" : form.announcement}
            </span>
            <span
              style={{
                display: "flex",
                gap: "1rem",
                opacity: 0.85,
                whiteSpace: "nowrap",
              }}
            >
              <span>Track order</span>
              <span>Request a product</span>
              <span>Help</span>
            </span>
          </div>

          <div className="admin-meta" style={{ marginTop: "1.2rem" }}>
            <div>
              <span>Store name</span>
              <strong>
                {form.storeName.trim() === "" ? "—" : form.storeName}
              </strong>
            </div>
            <div>
              <span>Support</span>
              <strong>
                {form.supportEmail} · {form.supportPhone}
              </strong>
            </div>
            <div>
              <span>Business hours</span>
              <strong>{form.businessHours}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{dirty ? "Unsaved changes" : "Saved"}</strong>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
