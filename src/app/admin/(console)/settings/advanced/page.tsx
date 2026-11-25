"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { useDemo } from "@/lib/store";
import { getAdminRecords, putAdminRecord } from "@/lib/admin-records";
import type { AdminRecordKind } from "@/lib/admin-records-config";
import { formatDateTime } from "@/lib/format";

type Stored = Record<string, unknown> & {
  id: string;
  updatedAt?: string;
  updatedBy?: string;
};
type Config = {
  taxRate: string;
  taxInclusive: boolean;
  taxRegistrationNumber: string;
  replyTo: string;
  orderSubject: string;
  supportSubject: string;
  policyVersion: string;
  policyApprovedBy: string;
  policyApprovedAt: string;
  auditRetentionDays: string;
  customerRetentionDays: string;
  reconciliationMinutes: string;
  reconciliationOwner: string;
};

const DEFAULTS: Config = {
  taxRate: "0",
  taxInclusive: true,
  taxRegistrationNumber: "",
  replyTo: "",
  orderSubject: "PAYDAN order {{reference}} updated",
  supportSubject: "PAYDAN: {{subject}}",
  policyVersion: "",
  policyApprovedBy: "",
  policyApprovedAt: "",
  auditRetentionDays: "365",
  customerRetentionDays: "2555",
  reconciliationMinutes: "15",
  reconciliationOwner: "Finance",
};

export default function AdvancedSettingsPage() {
  const { actions } = useDemo();
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [webhooks, setWebhooks] = useState<Stored[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      getAdminRecords<Stored>("taxSettings"),
      getAdminRecords<Stored>("notificationTemplates"),
      getAdminRecords<Stored>("policyApprovals"),
      getAdminRecords<Stored>("retentionRules"),
      getAdminRecords<Stored>("integrationStatus"),
      getAdminRecords<Stored>("webhookStatus"),
    ])
      .then(([tax, templates, policies, retention, integrations, hooks]) => {
        const taxRecord = tax.find((item) => item.id === "store") ?? tax[0];
        const template =
          templates.find((item) => item.id === "mail") ?? templates[0];
        const policy =
          policies.find((item) => item.id === "business") ?? policies[0];
        const rules =
          retention.find((item) => item.id === "default") ?? retention[0];
        const integration =
          integrations.find((item) => item.id === "paystack") ??
          integrations[0];
        setConfig({
          taxRate: String(taxRecord?.ratePercent ?? DEFAULTS.taxRate),
          taxInclusive: Boolean(taxRecord?.inclusive ?? DEFAULTS.taxInclusive),
          taxRegistrationNumber: String(
            taxRecord?.registrationNumber ?? DEFAULTS.taxRegistrationNumber,
          ),
          replyTo: String(template?.replyTo ?? DEFAULTS.replyTo),
          orderSubject: String(template?.orderSubject ?? DEFAULTS.orderSubject),
          supportSubject: String(
            template?.supportSubject ?? DEFAULTS.supportSubject,
          ),
          policyVersion: String(policy?.version ?? DEFAULTS.policyVersion),
          policyApprovedBy: String(
            policy?.approvedBy ?? DEFAULTS.policyApprovedBy,
          ),
          policyApprovedAt: String(policy?.approvedAt ?? "").slice(0, 10),
          auditRetentionDays: String(
            rules?.auditDays ?? DEFAULTS.auditRetentionDays,
          ),
          customerRetentionDays: String(
            rules?.customerDays ?? DEFAULTS.customerRetentionDays,
          ),
          reconciliationMinutes: String(
            integration?.reconciliationMinutes ??
              DEFAULTS.reconciliationMinutes,
          ),
          reconciliationOwner: String(
            integration?.owner ?? DEFAULTS.reconciliationOwner,
          ),
        });
        setWebhooks(hooks);
      })
      .catch((reason) => setError((reason as Error).message));
  }, []);

  async function save(
    key: string,
    kind: AdminRecordKind,
    id: string,
    patch: Record<string, unknown>,
  ) {
    setBusy(key);
    setError("");
    try {
      await putAdminRecord<Stored>(kind, id, patch);
      actions.notify(`${key} saved`, "success");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Settings"
        title="Advanced controls"
        description="Tax, customer notifications, policy approval, data retention, payment reconciliation and observed webhook health."
        action={
          <Link className="admin-btn quiet" href="/admin/settings">
            All settings
          </Link>
        }
      />
      {error ? <p className="form-error">{error}</p> : null}
      <div className="admin-panels">
        <form
          className="admin-card form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void save("Tax settings", "taxSettings", "store", {
              ratePercent: Math.max(
                0,
                Math.min(100, Number(config.taxRate) || 0),
              ),
              inclusive: config.taxInclusive,
              registrationNumber: config.taxRegistrationNumber.trim(),
            });
          }}
        >
          <h2 className="wide">Tax settings</h2>
          <label className="admin-field">
            Rate (%)
            <input
              className="admin-input"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={config.taxRate}
              onChange={(event) =>
                setConfig({ ...config, taxRate: event.target.value })
              }
            />
          </label>
          <label className="admin-field">
            Tax registration number
            <input
              className="admin-input"
              value={config.taxRegistrationNumber}
              onChange={(event) =>
                setConfig({
                  ...config,
                  taxRegistrationNumber: event.target.value,
                })
              }
            />
          </label>
          <label className={`choice${config.taxInclusive ? " active" : ""}`}>
            <input
              type="checkbox"
              checked={config.taxInclusive}
              onChange={(event) =>
                setConfig({ ...config, taxInclusive: event.target.checked })
              }
            />
            <span>Store prices include tax</span>
          </label>
          <button className="admin-btn primary" disabled={busy !== null}>
            {busy === "Tax settings" ? "Saving…" : "Save tax settings"}
          </button>
        </form>

        <form
          className="admin-card form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void save(
              "Notification templates",
              "notificationTemplates",
              "mail",
              {
                replyTo: config.replyTo.trim(),
                orderSubject: config.orderSubject.trim(),
                supportSubject: config.supportSubject.trim(),
              },
            );
          }}
        >
          <h2 className="wide">Notification templates</h2>
          <label className="admin-field wide">
            Reply-to email
            <input
              className="admin-input"
              type="email"
              value={config.replyTo}
              onChange={(event) =>
                setConfig({ ...config, replyTo: event.target.value })
              }
            />
          </label>
          <label className="admin-field wide">
            Order update subject
            <input
              className="admin-input"
              value={config.orderSubject}
              onChange={(event) =>
                setConfig({ ...config, orderSubject: event.target.value })
              }
            />
            <small>Use {"{{reference}}"} for the order reference.</small>
          </label>
          <label className="admin-field wide">
            Support reply subject
            <input
              className="admin-input"
              value={config.supportSubject}
              onChange={(event) =>
                setConfig({ ...config, supportSubject: event.target.value })
              }
            />
            <small>Use {"{{subject}}"} for the support subject.</small>
          </label>
          <button className="admin-btn primary" disabled={busy !== null}>
            {busy === "Notification templates" ? "Saving…" : "Save templates"}
          </button>
        </form>

        <form
          className="admin-card form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void save("Policy approval", "policyApprovals", "business", {
              version: config.policyVersion.trim(),
              approvedBy: config.policyApprovedBy.trim(),
              approvedAt: config.policyApprovedAt
                ? `${config.policyApprovedAt}T00:00:00.000Z`
                : "",
            });
          }}
        >
          <h2 className="wide">Policy approval</h2>
          <label className="admin-field">
            Version
            <input
              className="admin-input"
              value={config.policyVersion}
              onChange={(event) =>
                setConfig({ ...config, policyVersion: event.target.value })
              }
            />
          </label>
          <label className="admin-field">
            Approved by
            <input
              className="admin-input"
              value={config.policyApprovedBy}
              onChange={(event) =>
                setConfig({ ...config, policyApprovedBy: event.target.value })
              }
            />
          </label>
          <label className="admin-field">
            Approval date
            <input
              className="admin-input"
              type="date"
              value={config.policyApprovedAt}
              onChange={(event) =>
                setConfig({ ...config, policyApprovedAt: event.target.value })
              }
            />
          </label>
          <button className="admin-btn primary" disabled={busy !== null}>
            {busy === "Policy approval" ? "Saving…" : "Save approval"}
          </button>
        </form>

        <form
          className="admin-card form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void save("Retention rules", "retentionRules", "default", {
              auditDays: Math.max(
                30,
                Math.round(Number(config.auditRetentionDays) || 365),
              ),
              customerDays: Math.max(
                30,
                Math.round(Number(config.customerRetentionDays) || 2555),
              ),
            });
          }}
        >
          <h2 className="wide">Retention rules</h2>
          <label className="admin-field">
            Audit retention (days)
            <input
              className="admin-input"
              type="number"
              min={30}
              value={config.auditRetentionDays}
              onChange={(event) =>
                setConfig({ ...config, auditRetentionDays: event.target.value })
              }
            />
          </label>
          <label className="admin-field">
            Customer records (days)
            <input
              className="admin-input"
              type="number"
              min={30}
              value={config.customerRetentionDays}
              onChange={(event) =>
                setConfig({
                  ...config,
                  customerRetentionDays: event.target.value,
                })
              }
            />
          </label>
          <button className="admin-btn primary" disabled={busy !== null}>
            {busy === "Retention rules" ? "Saving…" : "Save retention"}
          </button>
        </form>

        <form
          className="admin-card form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void save(
              "Reconciliation settings",
              "integrationStatus",
              "paystack",
              {
                reconciliationMinutes: Math.max(
                  5,
                  Math.round(Number(config.reconciliationMinutes) || 15),
                ),
                owner: config.reconciliationOwner.trim(),
              },
            );
          }}
        >
          <h2 className="wide">Paystack reconciliation</h2>
          <label className="admin-field">
            Reconcile after (minutes)
            <input
              className="admin-input"
              type="number"
              min={5}
              value={config.reconciliationMinutes}
              onChange={(event) =>
                setConfig({
                  ...config,
                  reconciliationMinutes: event.target.value,
                })
              }
            />
          </label>
          <label className="admin-field">
            Business owner
            <input
              className="admin-input"
              value={config.reconciliationOwner}
              onChange={(event) =>
                setConfig({
                  ...config,
                  reconciliationOwner: event.target.value,
                })
              }
            />
          </label>
          <button className="admin-btn primary" disabled={busy !== null}>
            {busy === "Reconciliation settings"
              ? "Saving…"
              : "Save reconciliation"}
          </button>
        </form>

        <section className="admin-card">
          <h2>Webhook status</h2>
          <p>Verified provider events update these records automatically.</p>
          {webhooks.length ? (
            webhooks.map((hook) => (
              <div className="queue-item" key={hook.id}>
                <span>
                  <strong>{hook.id}</strong>
                  <br />
                  {String(hook.lastEventType ?? "No event type")}
                </span>
                <span>
                  {hook.lastEventAt
                    ? formatDateTime(String(hook.lastEventAt))
                    : "No verified event"}
                </span>
              </div>
            ))
          ) : (
            <p>No verified webhook delivery has been recorded yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
