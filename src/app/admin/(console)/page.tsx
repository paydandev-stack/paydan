"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import { AdminTable } from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDate, money, plural } from "@/lib/format";
import {
  fulfillmentStatusMeta,
  paymentStatusMeta,
  sourcingStatusMeta,
} from "@/lib/status";

/** Operations dashboard: KPI strip, latest orders, and an attention queue. */
export default function AdminDashboardPage() {
  const { state } = useDemo();

  const paidRevenue = state.orders
    .filter((order) => order.paymentStatus === "paid")
    .reduce((sum, order) => sum + order.total, 0);
  const openOrders = state.orders.filter(
    (order) => !["delivered", "cancelled"].includes(order.fulfillmentStatus),
  );
  const awaitingPayment = state.orders.filter(
    (order) => order.paymentStatus === "pending",
  );
  const openSourcing = state.sourcing.filter(
    (request) =>
      !["converted", "cancelled", "declined"].includes(request.status),
  );
  const liveProducts = state.products.filter(
    (product) => product.status === "published",
  );
  const draftProducts = state.products.filter(
    (product) => product.status === "draft",
  );
  const recentCustomers = state.customers.filter((customer) => {
    const joined = new Date(customer.joinedAt).getTime();
    return joined > Date.now() - 1000 * 60 * 60 * 24 * 30;
  });

  const recentOrders = [...state.orders]
    .sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1))
    .slice(0, 6);

  const unconfirmedStock = state.products.filter(
    (product) =>
      product.status === "published" && product.availability !== "in_stock",
  );
  const urgentGroups = state.orders.flatMap((order) =>
    order.vendorGroups
      .filter((group) => group.urgent || group.stage === "blocked")
      .map((group) => ({ order, group })),
  );
  const quotesAwaiting = state.sourcing.filter(
    (request) =>
      request.status === "quote_ready" ||
      request.status === "awaiting_customer",
  );

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Dashboard"
        description={`${plural(state.orders.length, "order")} recorded · ${plural(
          state.vendors.length,
          "vendor",
        )} in the network · secure store records`}
        action={
          <Link className="admin-btn" href="/admin/products/new">
            Add product
          </Link>
        }
      />

      <AdminKpis
        items={[
          {
            label: "Paid revenue",
            value: money(paidRevenue),
            note: "Paystack-verified orders",
          },
          {
            label: "Orders",
            value: state.orders.length,
            note: `${openOrders.length} still open`,
          },
          {
            label: "Awaiting payment",
            value: awaitingPayment.length,
            note: money(
              awaitingPayment.reduce((sum, order) => sum + order.total, 0),
            ),
          },
          {
            label: "Sourcing requests",
            value: openSourcing.length,
            note: "Open in the queue",
          },
          {
            label: "Live products",
            value: liveProducts.length,
            note: `${draftProducts.length} in draft`,
          },
          {
            label: "Customers",
            value: state.customers.length,
            note: `${recentCustomers.length} joined recently`,
          },
        ]}
      />

      <div className="admin-grid">
        <section>
          <div className="admin-section-title">
            <h2>Latest orders</h2>
            <Link className="admin-btn ghost" href="/admin/orders">
              All orders
            </Link>
          </div>

          <AdminTable
            template="1.1fr 1.2fr .9fr .8fr .8fr"
            head={["Order", "Customer", "Fulfilment", "Total", "Placed"]}
            caption="The six most recent orders"
          >
            {recentOrders.map((order) => (
              <div className="table-row" key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  style={{ color: "var(--green)", fontWeight: 700 }}
                >
                  {order.reference}
                </Link>
                <span>{order.customerName}</span>
                <StatusPill
                  tone={fulfillmentStatusMeta[order.fulfillmentStatus].tone}
                >
                  {fulfillmentStatusMeta[order.fulfillmentStatus].label}
                </StatusPill>
                <span style={{ textAlign: "right" }}>{money(order.total)}</span>
                <span style={{ color: "var(--muted)" }}>
                  {formatDate(order.placedAt, false)}
                </span>
              </div>
            ))}
          </AdminTable>

          <div className="admin-section-title" style={{ marginTop: "2rem" }}>
            <h2>Sourcing queue</h2>
            <Link className="admin-btn ghost" href="/admin/sourcing-requests">
              Open queue
            </Link>
          </div>

          {openSourcing.slice(0, 5).map((request) => (
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
          ))}
          {openSourcing.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: ".68rem" }}>
              The sourcing queue is clear.
            </p>
          ) : null}
        </section>

        <aside>
          <h2>Needs attention</h2>
          <div className="admin-legend">
            <div>
              <span className="red">Stock to confirm</span>
              <strong>{unconfirmedStock.length}</strong>
            </div>
            <div>
              <span className="orange">Urgent vendor groups</span>
              <strong>{urgentGroups.length}</strong>
            </div>
            <div>
              <span className="blue">Quotes to chase</span>
              <strong>{quotesAwaiting.length}</strong>
            </div>
            <div>
              <span className="neutral">Draft products</span>
              <strong>{draftProducts.length}</strong>
            </div>
          </div>

          <div className="admin-actions" style={{ marginTop: "1.2rem" }}>
            <Link className="admin-btn quiet" href="/admin/procurement">
              Procurement board
            </Link>
          </div>

          <h2 style={{ marginTop: "2rem" }}>Recent activity</h2>
          {state.audit.slice(0, 6).map((entry) => (
            <div className="queue-item" key={entry.id}>
              <span>
                <strong>{entry.action}</strong>
                <br />
                {entry.record}
              </span>
              <span style={{ color: "var(--muted)" }}>
                {formatDate(entry.at, false)}
              </span>
            </div>
          ))}
          {state.audit.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: ".68rem" }}>
              Changes you make in the console appear here.
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
