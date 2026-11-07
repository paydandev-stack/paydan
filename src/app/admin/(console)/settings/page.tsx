"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatDateTime, plural } from "@/lib/format";

const paystackLabels: Record<string, string> = {
  not_connected: "Not connected",
  test_placeholder: "See service configuration",
};

/** Link card summarising one settings area. */
function SettingsLink({
  href,
  title,
  summary,
  hint,
}: {
  href: string;
  title: string;
  summary: string;
  hint: string;
}) {
  return (
    <Link className="admin-card" href={href} style={{ display: "block" }}>
      <h3>{title}</h3>
      <p>
        <strong style={{ color: "var(--ink)" }}>{summary}</strong>
      </p>
      <p>{hint}</p>
      <span
        style={{ color: "var(--green)", fontSize: ".6rem", fontWeight: 800 }}
      >
        Open {title} →
      </span>
    </Link>
  );
}

/** Store configuration hub: entry points to each settings screen plus a read-only summary. */
export default function AdminSettingsPage() {
  const { state, actions } = useDemo();
  const [confirmReset, setConfirmReset] = useState(false);

  const settings = state.settings;
  const zones = state.shippingZones;
  const activeZones = zones.filter((zone) => zone.active);
  const roles = new Set(state.team.map((member) => member.role));

  const announcementSummary =
    settings.announcement.length > 54
      ? `${settings.announcement.slice(0, 54)}…`
      : settings.announcement;

  function handleReset() {
    actions.resetDemo();
    actions.notify("Demo data reset");
    setConfirmReset(false);
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Settings"
        title="Store settings"
        description={`Storefront identity, delivery zones, payment options and console team · secure store records`}
      />

      <div className="admin-panels">
        <SettingsLink
          href="/admin/settings/shipping"
          title="Shipping"
          summary={`${plural(zones.length, "delivery zone")} · ${activeZones.length} active`}
          hint="Fees and estimates by state, read by the checkout delivery calculation."
        />
        <SettingsLink
          href="/admin/settings/payments"
          title="Payments"
          summary={`Paystack ${paystackLabels[settings.paystackStatus].toLowerCase()} · bank transfer ${
            settings.transferEnabled ? "on" : "off"
          }`}
          hint="Provider connection state, the bank transfer switch and the accepted currency."
        />
        <SettingsLink
          href="/admin/settings/team"
          title="Team"
          summary={`${plural(state.team.length, "member")} · ${plural(roles.size, "role")}`}
          hint="Operators, their recorded roles and invite status for this console."
        />
        <SettingsLink
          href="/admin/settings/storefront"
          title="Storefront"
          summary={`${settings.storeName} · ${announcementSummary}`}
          hint="Store name, support contact details, business hours and the header announcement."
        />
      </div>

      <div className="admin-panels" style={{ marginTop: "1rem" }}>
        <section className="admin-card">
          <h2>Storefront settings</h2>
          <p>Current store settings.</p>
          <div className="admin-meta">
            <div>
              <span>Store name</span>
              <strong>{settings.storeName}</strong>
            </div>
            <div>
              <span>Support email</span>
              <strong>{settings.supportEmail}</strong>
            </div>
            <div>
              <span>Support phone</span>
              <strong>{settings.supportPhone}</strong>
            </div>
            <div>
              <span>Business hours</span>
              <strong>{settings.businessHours}</strong>
            </div>
            <div>
              <span>Currency</span>
              <strong>{settings.currency}</strong>
            </div>
            <div>
              <span>Announcement</span>
              <strong>{settings.announcement}</strong>
            </div>
            <div>
              <span>Paystack</span>
              <strong>{paystackLabels[settings.paystackStatus]}</strong>
            </div>
            <div>
              <span>Bank transfer</span>
              <strong>
                {settings.transferEnabled ? "Enabled" : "Disabled"}
              </strong>
            </div>
          </div>
          <div className="admin-actions" style={{ marginTop: "1rem" }}>
            <Link className="admin-btn ghost" href="/admin/settings/storefront">
              Edit storefront settings
            </Link>
            <Link className="admin-btn quiet" href="/admin/settings/payments">
              Payment settings
            </Link>
          </div>
        </section>

        <section className="admin-card">
          <h2>Recent activity</h2>
          <p>The latest changes recorded in the audit trail.</p>
          <div style={{ marginTop: ".8rem" }}>
            {state.audit.slice(0, 8).map((entry) => (
              <div className="queue-item" key={entry.id}>
                <span>
                  <strong>{entry.action}</strong>
                  <br />
                  {entry.record} · {entry.actor}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {formatDateTime(entry.at)}
                </span>
              </div>
            ))}
            {state.audit.length === 0 ? (
              <p>Changes made in the console appear here.</p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
