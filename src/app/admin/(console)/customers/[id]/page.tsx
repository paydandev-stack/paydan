"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminTable,
  AdminTextArea,
  AdminTextField,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import type { Address, AuditEntry, Customer } from "@/lib/types";
import { formatDate, formatDateTime, money, plural } from "@/lib/format";
import {
  fulfillmentStatusMeta,
  paymentStatusMeta,
  returnStatusMeta,
  sourcingStatusMeta,
} from "@/lib/status";
import { hasCapability } from "@/lib/capabilities";
type ProfilePatch = Pick<
  Customer,
  | "name"
  | "phone"
  | "city"
  | "state"
  | "notes"
  | "tags"
  | "segments"
  | "lifecycleStage"
  | "marketingConsent"
>;
/** Editable contact details; segments stay read-only (see note in the form). */
function ProfileForm({
  customer,
  onSave,
  canEditNotes,
  canManage,
}: {
  customer: Customer;
  onSave: (patch: ProfilePatch) => void;
  canEditNotes: boolean;
  canManage: boolean;
}) {
  const [form, setForm] = useState<ProfilePatch>({
    name: customer.name,
    phone: customer.phone,
    city: customer.city,
    state: customer.state,
    notes: customer.notes,
    tags: customer.tags ?? [],
    segments: customer.segments ?? [],
    lifecycleStage: customer.lifecycleStage ?? "new",
    marketingConsent: customer.marketingConsent ?? false,
  });
  const reset = () =>
    setForm({
      name: customer.name,
      phone: customer.phone,
      city: customer.city,
      state: customer.state,
      notes: customer.notes,
      tags: customer.tags ?? [],
      segments: customer.segments ?? [],
      lifecycleStage: customer.lifecycleStage ?? "new",
      marketingConsent: customer.marketingConsent ?? false,
    });
  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <AdminTextField
        label="Name"
        required
        value={form.name}
        readOnly={!canManage}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <AdminTextField
        label="Email"
        type="email"
        required
        value={customer.email}
        readOnly
        hint="Login email changes require a verified account workflow."
      />
      <AdminTextField
        label="Phone"
        value={form.phone}
        readOnly={!canManage}
        onChange={(event) => setForm({ ...form, phone: event.target.value })}
      />
      <AdminTextField
        label="City"
        value={form.city}
        readOnly={!canManage}
        onChange={(event) => setForm({ ...form, city: event.target.value })}
      />
      <AdminTextField
        label="State"
        value={form.state}
        readOnly={!canManage}
        onChange={(event) => setForm({ ...form, state: event.target.value })}
      />
      <AdminTextField
        label="Tags"
        value={form.tags.join(", ")}
        readOnly={!canManage}
        hint="Comma-separated operational labels."
        onChange={(event) =>
          setForm({
            ...form,
            tags: event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          })
        }
      />
      <AdminTextField
        label="Segments"
        value={form.segments.join(", ")}
        readOnly={!canManage}
        hint="Comma-separated lifecycle or campaign segments."
        onChange={(event) =>
          setForm({
            ...form,
            segments: event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          })
        }
      />
      <label className="admin-field">
        Lifecycle stage
        <select
          className="admin-select"
          value={form.lifecycleStage}
          disabled={!canManage}
          onChange={(event) =>
            setForm({
              ...form,
              lifecycleStage: event.target.value as Customer["lifecycleStage"],
            })
          }
        >
          {[
            ["new", "New"],
            ["active", "Active"],
            ["vip", "VIP"],
            ["at_risk", "At risk"],
            ["inactive", "Inactive"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Marketing consent</span>
        <span>
          <input
            type="checkbox"
            checked={form.marketingConsent}
            disabled={!canManage}
            onChange={(event) =>
              setForm({ ...form, marketingConsent: event.target.checked })
            }
          />{" "}
          Customer has recorded consent
        </span>
      </label>
      <AdminTextArea
        label="Internal notes"
        wide
        hint="Visible to operators only — never shown to the customer."
        value={form.notes}
        readOnly={!canEditNotes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
      />
      {canEditNotes || canManage ? (
        <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
          <button className="admin-btn quiet" type="button" onClick={reset}>
            Reset
          </button>
          <button type="submit" className="admin-btn primary">
            Save profile
          </button>
        </div>
      ) : null}
    </form>
  );
}
/** Single customer record: editable profile plus their orders, returns, sourcing and addresses. */
export default function AdminCustomerDetailPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions, refresh } = useDemo();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const customer = state.customers.find((item) => item.id === id);
  const [supportTickets, setSupportTickets] = useState<
    Array<{ id: string; subject: string; status: string; updatedAt: string }>
  >([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmAnonymize, setConfirmAnonymize] = useState(false);
  useEffect(() => {
    if (!customer) return;
    void Promise.all([
      api<{
        tickets: Array<{
          id: string;
          subject: string;
          status: string;
          updatedAt: string;
        }>;
      }>("/api/admin/support?q=" + encodeURIComponent(customer.email)).then(
        (result) => setSupportTickets(result.tickets),
      ),
      api<{ entries: AuditEntry[] }>(
        "/api/admin/audit?record=" + encodeURIComponent(customer.id),
      ).then((result) => setHistory(result.entries)),
    ]).catch(() => undefined);
  }, [customer]);
  if (!customer) notFound();
  const canEditNotes = hasCapability(
    state.adminSession?.role,
    "customers.support-note",
  );
  const canManage = hasCapability(state.adminSession?.role, "customers.manage");
  const orders = [
    ...state.orders
      .filter((order) => order.customerId === customer.id)
      .sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1)),
  ];
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const lifetimeSpend = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const lastOrder = orders[0];
  const returns = state.returns.filter(
    (request) => request.customerId === customer.id,
  );
  const sourcing = state.sourcing.filter(
    (request) =>
      request.customerId === customer.id ||
      request.email.trim().toLowerCase() ===
        customer.email.trim().toLowerCase(),
  );
  // `Address` carries no owner field, so the only addresses that genuinely belong
  // to this customer are the ones recorded on their own orders.
  const addressKey = (address: Address) =>
    `${address.street}|${address.city}|${address.state}`;
  const addresses = [
    ...new Map(
      orders.map((order) => [addressKey(order.address), order.address]),
    ).values(),
  ];
  const saveProfile = async (patch: ProfilePatch) => {
    try {
      await actions.updateCustomer(
        customer.id,
        canManage ? patch : { notes: patch.notes },
      );
      actions.notify(`Profile saved for ${patch.name}`, "success");
    } catch (error) {
      actions.notify(
        error instanceof Error ? error.message : "Could not save the profile.",
        "error",
      );
    }
  };
  function exportProfile() {
    const payload = {
      exportedAt: new Date().toISOString(),
      customer,
      orders,
      returns,
      sourcing,
      supportTickets,
      auditHistory: history,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `paydan-customer-${id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function mergeProfile() {
    if (!mergeTarget || busy) return;
    setBusy(true);
    try {
      await api("/api/commands", {
        name: "mergeCustomers",
        args: [{ primaryId: id, secondaryId: mergeTarget }],
        key: crypto.randomUUID(),
      });
      await refresh();
      setMergeTarget("");
      actions.notify("Duplicate profile merged into this customer.", "success");
    } catch (error) {
      actions.notify(
        error instanceof Error ? error.message : "Could not merge profiles.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  async function anonymizeProfile() {
    if (!confirmAnonymize || busy) return;
    setBusy(true);
    try {
      await api("/api/commands", {
        name: "deleteCustomer",
        args: [id],
        key: crypto.randomUUID(),
      });
      await refresh();
      window.location.assign("/admin/customers");
    } catch (error) {
      actions.notify(
        error instanceof Error ? error.message : "Could not anonymize profile.",
        "error",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Customers"
        title={customer.name}
        description={`${customer.email} · ${customer.phone} · ${customer.city}, ${customer.state} · joined ${formatDate(customer.joinedAt)}`}
        action={
          <Link className="admin-btn quiet" href="/admin/customers">
            All customers
          </Link>
        }
      />

      <div className="admin-detail">
        <div style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
          <section className="admin-card">
            <h2>Profile</h2>
            <ProfileForm
              customer={customer}
              onSave={saveProfile}
              canEditNotes={canEditNotes}
              canManage={canManage}
            />
          </section>

          <section className="admin-card">
            <h2>Support tickets</h2>
            {supportTickets.length ? (
              supportTickets.map((ticket) => (
                <Link
                  className="queue-item"
                  href={`/admin/support?q=${encodeURIComponent(customer.email)}`}
                  key={ticket.id}
                >
                  <span>
                    <strong>{ticket.subject}</strong>
                    <br />
                    Updated {formatDateTime(ticket.updatedAt)}
                  </span>
                  <StatusPill
                    tone={ticket.status === "resolved" ? "green" : "orange"}
                  >
                    {ticket.status.replaceAll("_", " ")}
                  </StatusPill>
                </Link>
              ))
            ) : (
              <p>No support tickets match this customer.</p>
            )}
          </section>

          <section className="admin-card">
            <h2>Profile history</h2>
            {history.length ? (
              history.slice(0, 20).map((entry) => (
                <div className="queue-item" key={entry.id}>
                  <span>
                    <strong>{entry.action}</strong>
                    <br />
                    {entry.actor}
                  </span>
                  <span>{formatDateTime(entry.at)}</span>
                </div>
              ))
            ) : (
              <p>No audited profile changes yet.</p>
            )}
          </section>

          <section className="admin-card">
            <h2>Orders</h2>
            {orders.length === 0 ? (
              <AdminEmpty
                title="No orders yet"
                hint="This customer has not placed an order in the store."
              />
            ) : (
              <>
                <p>
                  {plural(orders.length, "order")} · {money(lifetimeSpend)} paid
                  to date
                </p>
                <AdminTable
                  template="1fr .9fr 1fr .9fr .8fr"
                  head={["Order", "Placed", "Fulfilment", "Payment", "Total"]}
                  caption={`Orders placed by ${customer.name}`}
                >
                  {orders.map((order) => (
                    <div className="table-row" key={order.id}>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        style={{ color: "var(--green)", fontWeight: 700 }}
                      >
                        {order.reference}
                      </Link>
                      <span style={{ color: "var(--muted)" }}>
                        {formatDate(order.placedAt, false)}
                      </span>
                      <StatusPill
                        tone={
                          fulfillmentStatusMeta[order.fulfillmentStatus].tone
                        }
                      >
                        {fulfillmentStatusMeta[order.fulfillmentStatus].label}
                      </StatusPill>
                      <StatusPill
                        tone={paymentStatusMeta[order.paymentStatus].tone}
                      >
                        {paymentStatusMeta[order.paymentStatus].label}
                      </StatusPill>
                      <span style={{ textAlign: "right" }}>
                        {money(order.total)}
                      </span>
                    </div>
                  ))}
                </AdminTable>
              </>
            )}
          </section>

          <section className="admin-card">
            <h2>Returns</h2>
            {returns.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: ".68rem" }}>
                No return requests recorded for this customer.
              </p>
            ) : (
              returns.map((request) => (
                <div className="queue-item" key={request.id}>
                  <span>
                    <strong>{request.reference}</strong> · {request.productName}{" "}
                    · {plural(request.quantity, "unit")}
                  </span>
                  <StatusPill tone={returnStatusMeta[request.status].tone}>
                    {returnStatusMeta[request.status].label}
                  </StatusPill>
                </div>
              ))
            )}
          </section>

          <section className="admin-card">
            <h2>Sourcing requests</h2>
            {sourcing.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: ".68rem" }}>
                No sourcing requests match this customer.
              </p>
            ) : (
              sourcing.map((request) => (
                <Link
                  key={request.id}
                  href={`/admin/sourcing-requests/${request.id}`}
                  className="queue-item"
                  style={{ width: "100%" }}
                >
                  <span>
                    <strong>{request.reference}</strong> · {request.productName}
                  </span>
                  <StatusPill tone={sourcingStatusMeta[request.status].tone}>
                    {sourcingStatusMeta[request.status].label}
                  </StatusPill>
                </Link>
              ))
            )}
          </section>

          <section className="admin-card">
            <h2>Delivery addresses</h2>
            {addresses.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: ".68rem" }}>
                No delivery address has been recorded on an order for this
                customer.
              </p>
            ) : (
              addresses.map((address) => (
                <div className="queue-item" key={address.id}>
                  <span>
                    <strong>
                      {address.label} · {address.recipient}
                    </strong>
                    <br />
                    {address.street}
                    {address.landmark ? `, ${address.landmark}` : ""} —{" "}
                    {address.city}, {address.state}
                  </span>
                  {address.isDefault ? (
                    <span className="status">Default</span>
                  ) : null}
                </div>
              ))
            )}
            <p>
              Delivery addresses shown here belong to this customer’s orders.
            </p>
          </section>
        </div>

        <aside className="admin-card">
          <h2>Customer stats</h2>
          <div className="admin-meta">
            <div>
              <span>Lifetime spend (paid)</span>
              <strong>{money(lifetimeSpend)}</strong>
            </div>
            <div>
              <span>Orders</span>
              <strong>{orders.length}</strong>
            </div>
            <div>
              <span>Paid orders</span>
              <strong>{paidOrders.length}</strong>
            </div>
            <div>
              <span>Last order</span>
              <strong>
                {lastOrder ? formatDate(lastOrder.placedAt) : "—"}
              </strong>
            </div>
            <div>
              <span>Member since</span>
              <strong>{formatDate(customer.joinedAt)}</strong>
            </div>
            <div>
              <span>Sourcing requests</span>
              <strong>{sourcing.length}</strong>
            </div>
            <div>
              <span>Returns</span>
              <strong>{returns.length}</strong>
            </div>
          </div>
          <div className="admin-actions" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="admin-btn secondary"
              onClick={exportProfile}
            >
              Export customer data
            </button>
          </div>
          {canManage ? (
            <>
              <hr
                style={{ margin: "1.25rem 0", borderColor: "var(--border)" }}
              />
              <h3>Merge duplicate</h3>
              <select
                className="admin-select"
                value={mergeTarget}
                onChange={(event) => setMergeTarget(event.target.value)}
              >
                <option value="">Choose duplicate profile</option>
                {state.customers
                  .filter((item) => item.id !== customer.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.email}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="admin-btn secondary"
                disabled={!mergeTarget || busy}
                onClick={() => void mergeProfile()}
              >
                Merge into this profile
              </button>
              <h3 style={{ marginTop: "1.25rem" }}>Privacy request</h3>
              <label>
                <input
                  type="checkbox"
                  checked={confirmAnonymize}
                  onChange={(event) =>
                    setConfirmAnonymize(event.target.checked)
                  }
                />{" "}
                Confirm permanent anonymization
              </label>
              <button
                type="button"
                className="admin-btn danger"
                disabled={!confirmAnonymize || busy}
                onClick={() => void anonymizeProfile()}
              >
                Anonymize personal data
              </button>
            </>
          ) : null}
        </aside>
      </div>
    </>
  );
}
