"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import { AdminSearch, AdminSelect } from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
import { hasCapability } from "@/lib/capabilities";
import { formatDateTime, money } from "@/lib/format";

type Refund = {
  id: string;
  return_id: string;
  amount_kobo: number;
  status: string;
  provider_id?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
};

type RefundPage = { refunds: Refund[]; nextCursor: string | null };

const DAY = 86_400_000;

export default function Returns() {
  const { state, refresh } = useDemo();
  const canRefund = hasCapability(state.adminSession?.role, "refunds.issue");
  const [note, setNote] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [age, setAge] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const loadRefunds = useCallback(async (next?: string, append = false) => {
    const params = new URLSearchParams();
    if (next) params.set("cursor", next);
    const page = await api<RefundPage>(`/api/admin/returns?${params}`);
    setRefunds((current) =>
      append ? [...current, ...page.refunds] : page.refunds,
    );
    setCursor(page.nextCursor);
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([refresh(), loadRefunds()]);
  }, [loadRefunds, refresh]);

  useEffect(() => {
    void reload().catch((cause) => setMessage((cause as Error).message));
  }, [reload]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.returns.filter((request) => {
      const refund = refunds.find((item) => item.return_id === request.id);
      if (
        needle &&
        ![
          request.reference,
          request.productName,
          request.reason,
          request.sku ?? "",
        ].some((value) => value.toLowerCase().includes(needle))
      )
        return false;
      if (status !== "all" && request.status !== status) return false;
      const old = Date.now() - Date.parse(request.createdAt);
      if (age === "24h" && old < DAY) return false;
      if (age === "7d" && old < 7 * DAY) return false;
      if (
        age === "high" &&
        (!refund || Number(refund.amount_kobo) < 25_000_000)
      )
        return false;
      return true;
    });
  }, [age, query, refunds, state.returns, status]);

  async function update(id: string, nextStatus: string) {
    setBusy(id);
    setMessage("");
    try {
      await api("/api/commands", {
        name: "updateReturn",
        args: [id, { status: nextStatus, adminNote: note[id] ?? "" }],
        key: crypto.randomUUID(),
      });
      await reload();
      setMessage("Return updated.");
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function refund(id: string) {
    setBusy(id);
    setMessage("");
    try {
      const naira = amount[id]?.trim() ? Number(amount[id]) : undefined;
      if (naira !== undefined && (!Number.isFinite(naira) || naira <= 0))
        throw new Error("Enter a partial refund amount greater than zero.");
      const result = await api<{ message: string }>("/api/admin/returns", {
        returnId: id,
        amountKobo: naira === undefined ? undefined : Math.round(naira * 100),
      });
      setMessage(result.message);
      await reload();
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Customer care"
        title="Returns & refunds"
        description="Review return SLAs, approve requests, and reconcile Paystack refunds without duplicate submissions."
      />
      <AdminKpis
        items={[
          {
            label: "Open requests",
            value: state.returns.filter(
              (item) => !["rejected", "refunded"].includes(item.status),
            ).length,
          },
          {
            label: "Over 24 hours",
            value: state.returns.filter(
              (item) =>
                Date.now() - Date.parse(item.createdAt) > DAY &&
                !["rejected", "refunded"].includes(item.status),
            ).length,
          },
          {
            label: "Approved",
            value: state.returns.filter((item) => item.status === "approved")
              .length,
          },
          {
            label: "Provider exceptions",
            value: refunds.filter(
              (item) => item.last_error || item.status === "submission_unknown",
            ).length,
          },
        ]}
      />
      <div className="admin-filters">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search return, product, reason or SKU"
          label="Search returns"
        />
        <AdminSelect
          label="Return status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            ...[
              "requested",
              "under_review",
              "approved",
              "rejected",
              "refunded",
            ].map((value) => ({
              value,
              label: value.replaceAll("_", " "),
            })),
          ]}
        />
        <AdminSelect
          label="Age or value"
          value={age}
          onChange={setAge}
          options={[
            { value: "all", label: "Any age/value" },
            { value: "24h", label: "Older than 24 hours" },
            { value: "7d", label: "Older than 7 days" },
            { value: "high", label: "Refund over NGN 250,000" },
          ]}
        />
      </div>
      {message ? (
        <p className="admin-note" role="status">
          {message}
        </p>
      ) : null}
      <div className="operations-list">
        {!visible.length ? (
          <p>No return requests match these filters.</p>
        ) : null}
        {visible.map((request) => {
          const provider = refunds.find(
            (item) => item.return_id === request.id,
          );
          const ageHours = Math.max(
            0,
            Math.floor(
              (Date.now() - Date.parse(request.createdAt)) / 3_600_000,
            ),
          );
          const overdue =
            ageHours >= 24 &&
            !["rejected", "refunded"].includes(request.status);
          return (
            <article key={request.id}>
              <div className="admin-section-card-header">
                <div>
                  <h2>
                    {request.reference} · {request.productName}
                  </h2>
                  <p>
                    {request.quantity} items · {request.reason} · opened{" "}
                    {formatDateTime(request.createdAt)}
                  </p>
                </div>
                <StatusPill tone={overdue ? "red" : "green"}>
                  {overdue
                    ? `${ageHours}h · SLA overdue`
                    : `${ageHours}h · within SLA`}
                </StatusPill>
              </div>
              <p>{request.detail}</p>
              {request.images?.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  View attached image
                </a>
              ))}
              <label className="admin-field wide">
                Review notes
                <textarea
                  value={note[request.id] ?? request.adminNote}
                  onChange={(event) =>
                    setNote((current) => ({
                      ...current,
                      [request.id]: event.target.value,
                    }))
                  }
                />
              </label>
              {request.status !== "refunded" ? (
                <div className="admin-actions">
                  <button
                    className="admin-btn secondary"
                    disabled={busy === request.id}
                    onClick={() => void update(request.id, "under_review")}
                  >
                    Review
                  </button>
                  <button
                    className="admin-btn primary"
                    disabled={busy === request.id}
                    onClick={() => void update(request.id, "approved")}
                  >
                    Approve return
                  </button>
                  <button
                    className="admin-btn danger"
                    disabled={busy === request.id}
                    onClick={() => void update(request.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
              {canRefund && request.status === "approved" && !provider ? (
                <div className="admin-actions" style={{ marginTop: ".8rem" }}>
                  <label className="admin-field">
                    Partial amount (NGN, optional)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount[request.id] ?? ""}
                      onChange={(event) =>
                        setAmount((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      placeholder="Leave blank for full item amount"
                    />
                  </label>
                  <button
                    className="admin-btn primary"
                    disabled={busy === request.id}
                    onClick={() => void refund(request.id)}
                  >
                    {busy === request.id ? "Submitting…" : "Issue refund"}
                  </button>
                </div>
              ) : null}
              {provider ? (
                <div className="admin-note" style={{ marginTop: ".8rem" }}>
                  <strong>
                    Refund {provider.status} ·{" "}
                    {money(Number(provider.amount_kobo) / 100)}
                  </strong>
                  <p>
                    Provider reference:{" "}
                    {provider.provider_id || "Awaiting reconciliation"} · last
                    checked{" "}
                    {formatDateTime(provider.updated_at || provider.created_at)}
                  </p>
                  {provider.last_error ? (
                    <p className="form-error">
                      Latest provider error: {provider.last_error}
                    </p>
                  ) : null}
                  {provider.provider_id ? (
                    <button
                      className="admin-btn secondary"
                      disabled={busy === request.id}
                      onClick={async () => {
                        setBusy(request.id);
                        try {
                          await api("/api/admin/returns", {
                            action: "verify",
                            providerId: provider.provider_id,
                          });
                          await reload();
                          setMessage("Refund status refreshed.");
                        } catch (cause) {
                          setMessage((cause as Error).message);
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      Refresh Paystack status
                    </button>
                  ) : (
                    <p>
                      Submission outcome is ambiguous. Reconcile in Paystack
                      before taking another action.
                    </p>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {cursor ? (
        <div className="admin-actions" style={{ justifyContent: "center" }}>
          <button
            className="admin-btn secondary"
            onClick={() => void loadRefunds(cursor, true)}
          >
            Load older refunds
          </button>
        </div>
      ) : null}
    </>
  );
}
