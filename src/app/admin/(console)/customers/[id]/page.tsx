"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminTable,
  AdminTextArea,
  AdminTextField,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import type { Address, Customer } from "@/lib/types";
import { formatDate, money, plural } from "@/lib/format";
import {
  fulfillmentStatusMeta,
  paymentStatusMeta,
  returnStatusMeta,
  sourcingStatusMeta,
} from "@/lib/status";
type ProfilePatch = Pick<
  Customer,
  "name" | "email" | "phone" | "city" | "state" | "notes"
>;
/** Editable contact details; segments stay read-only (see note in the form). */
function ProfileForm({
  customer,
  onSave,
}: {
  customer: Customer;
  onSave: (patch: ProfilePatch) => void;
}) {
  const [form, setForm] = useState<ProfilePatch>({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    state: customer.state,
    notes: customer.notes,
  });
  const reset = () =>
    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      state: customer.state,
      notes: customer.notes,
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
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <AdminTextField
        label="Email"
        type="email"
        required
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
      />
      <AdminTextField
        label="Phone"
        value={form.phone}
        onChange={(event) => setForm({ ...form, phone: event.target.value })}
      />
      <AdminTextField
        label="City"
        value={form.city}
        onChange={(event) => setForm({ ...form, city: event.target.value })}
      />
      <AdminTextField
        label="State"
        value={form.state}
        onChange={(event) => setForm({ ...form, state: event.target.value })}
      />
      <div className="admin-field">
        <span>Segments (read-only)</span>
        <div className="admin-chips">
          {customer.segments.map((item) => (
            <span className="admin-chip active" key={item}>
              {item}
            </span>
          ))}
        </div>
        <p>
          Update contact details and internal handling notes for this customer.
        </p>
      </div>
      <AdminTextArea
        label="Internal notes"
        wide
        hint="Visible to operators only — never shown to the customer."
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
      />
      <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
        <button type="button" onClick={reset}>
          Reset
        </button>
        <button type="submit" className="primary">
          Save profile
        </button>
      </div>
    </form>
  );
}
/** Single customer record: editable profile plus their orders, returns, sourcing and addresses. */
export default function AdminCustomerDetailPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions } = useDemo();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const customer = state.customers.find((item) => item.id === id);
  if (!customer) notFound();
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
      await actions.updateCustomer(customer.id, patch);
      actions.notify(`Profile saved for ${patch.name}`, "success");
    } catch (error) {}
  };
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
            <ProfileForm customer={customer} onSave={saveProfile} />
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
        </aside>
      </div>
    </>
  );
}
