"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import { AdminTable } from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { ArrowRightIcon, CheckIcon, GridIcon, PlusIcon, StoreIcon } from "@/components/icons";
import { formatDate, formatDateTime, money, plural } from "@/lib/format";
import {
  fulfillmentStatusMeta,
  paymentStatusMeta,
  sourcingStatusMeta,
} from "@/lib/status";

/** Operations dashboard: KPI strip, latest orders, and an attention queue. */
type OperationsHealth = {
  deadMail: number;
  stalePayments: number;
  unresolvedRefunds: number;
  launchReady: boolean | null;
  failedUploads: number;
};

export default function AdminDashboardPage() {
  const { state } = useDemo();
  const [health, setHealth] = useState<OperationsHealth | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refreshHealth = useCallback(async () => {
    setRefreshing(true);
    try {
      const [operations, launch] = await Promise.allSettled([
        api<{
          mail?: { dead?: number };
          payments?: { pending?: number; stale?: number };
          refunds?: { unresolved?: number };
        }>("/api/admin/operations"),
        api<{ ready: boolean }>("/api/admin/launch"),
      ]);
      const ops = operations.status === "fulfilled" ? operations.value : {};
      let failedUploads = 0;
      try {
        const library = await api<{ failedUploads?: number }>(
          "/api/media/library",
        );
        failedUploads = Number(library.failedUploads ?? 0);
      } catch {
        failedUploads = 0;
      }
      setHealth({
        deadMail: Number(ops.mail?.dead ?? 0),
        stalePayments: Number(
          ops.payments?.stale ?? ops.payments?.pending ?? 0,
        ),
        unresolvedRefunds: Number(ops.refunds?.unresolved ?? 0),
        launchReady: launch.status === "fulfilled" ? launch.value.ready : null,
        failedUploads,
      });
      setLastUpdated(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

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

      <div className="admin-quick-actions">
        <Link className="admin-quick-action" href="/admin/products/new">
          <span className="admin-quick-action-icon" aria-hidden="true">
            <PlusIcon />
          </span>
          <span>
            <strong>Add a product</strong>
            <small>Create a catalogue listing</small>
          </span>
        </Link>
        <Link className="admin-quick-action" href="/admin/vendors/new">
          <span className="admin-quick-action-icon" aria-hidden="true">
            <StoreIcon />
          </span>
          <span>
            <strong>Create vendor login</strong>
            <small>Invite a supplier account</small>
          </span>
        </Link>
        <Link className="admin-quick-action" href="/admin/orders">
          <span className="admin-quick-action-icon" aria-hidden="true">
            <ArrowRightIcon />
          </span>
          <span>
            <strong>Review orders</strong>
            <small>Open the latest order queue</small>
          </span>
        </Link>
        <Link
          className="admin-quick-action"
          href="/admin/inventory?attention=stock"
        >
          <span className="admin-quick-action-icon" aria-hidden="true">
            <GridIcon />
          </span>
          <span>
            <strong>Review stock</strong>
            <small>Check low and blocked stock</small>
          </span>
        </Link>
        <Link className="admin-quick-action" href="/admin/launch">
          <span className="admin-quick-action-icon" aria-hidden="true">
            <CheckIcon />
          </span>
          <span>
            <strong>Run launch checks</strong>
            <small>Review release checks</small>
          </span>
        </Link>
      </div>

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
            <Link
              className="admin-attention-link"
              href="/admin/inventory?attention=stock"
            >
              <span className="red">Stock to confirm</span>
              <strong>{unconfirmedStock.length}</strong>
            </Link>
            <Link
              className="admin-attention-link"
              href="/admin/procurement?urgent=true"
            >
              <span className="orange">Urgent vendor groups</span>
              <strong>{urgentGroups.length}</strong>
            </Link>
            <Link
              className="admin-attention-link"
              href="/admin/sourcing-requests?status=awaiting_customer"
            >
              <span className="blue">Quotes to chase</span>
              <strong>{quotesAwaiting.length}</strong>
            </Link>
            <Link
              className="admin-attention-link"
              href="/admin/products?status=draft"
            >
              <span className="neutral">Draft products</span>
              <strong>{draftProducts.length}</strong>
            </Link>
          </div>

          <section className="admin-card" style={{ marginTop: "1rem" }}>
            <div className="admin-section-title">
              <h2 style={{ margin: 0 }}>Operations health</h2>
              <button
                type="button"
                className="admin-btn quiet"
                disabled={refreshing}
                onClick={() => void refreshHealth()}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {health ? (
              <div className="admin-legend">
                <div>
                  <span className="orange">Stale payments</span>
                  <strong>{health.stalePayments}</strong>
                </div>
                <div>
                  <span className="red">Dead mail</span>
                  <strong>{health.deadMail}</strong>
                </div>
                <div>
                  <span className="blue">Unresolved refunds</span>
                  <strong>{health.unresolvedRefunds}</strong>
                </div>
                <div>
                  <span className="neutral">Failed uploads</span>
                  <strong>{health.failedUploads}</strong>
                </div>
                <div>
                  <span className="neutral">Launch</span>
                  <strong>
                    {health.launchReady === null
                      ? "—"
                      : health.launchReady
                        ? "Ready"
                        : "Gated"}
                  </strong>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: ".66rem" }}>
                Loading health…
              </p>
            )}
            {lastUpdated ? (
              <small style={{ color: "var(--muted)", fontSize: ".6rem" }}>
                Updated {formatDateTime(lastUpdated)}
              </small>
            ) : null}
          </section>

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
