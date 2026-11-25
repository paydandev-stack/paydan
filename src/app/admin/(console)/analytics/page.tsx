"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import { AdminEmpty, AdminTable } from "@/components/admin/data-table";
import type { FulfillmentStatus } from "@/lib/types";
import { compactMoney, money, plural } from "@/lib/format";
import { fulfillmentStatusMeta } from "@/lib/status";
import { api } from "@/lib/api-client";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const monthLabel = (bucket: string) =>
  `${MONTH_LABELS[Number(bucket.slice(5, 7)) - 1]} ’${bucket.slice(2, 4)}`;

type ServerMetrics = {
  processedRefunds: number;
  processedRefundCount: number;
  pendingRefundCount: number;
  paidRevenue: number;
  paidOrderCount: number;
  costOfGoods: number;
  grossMargin: number;
  grossMarginRate: number;
  paymentSuccessRate: number;
  paymentAttempts: number;
  stockouts: number;
  newCustomers: number;
  returningCustomers: number;
  comparisonRevenuePct: number | null;
  topProducts: Array<{
    id: string;
    name: string;
    units: number;
    revenue: number;
  }>;
  cohorts: Array<{
    cohort: string;
    customers: number;
    revenue: number;
    ltv: number;
  }>;
};

/** Fulfilment rows: tone class per status, green is the stylesheet default. */
const FULFILMENT_ROWS: { status: FulfillmentStatus; tone: string }[] = [
  { status: "awaiting_payment", tone: "orange" },
  { status: "processing", tone: "blue" },
  { status: "sourcing", tone: "blue" },
  { status: "partially_packed", tone: "orange" },
  { status: "dispatched", tone: "" },
  { status: "delivered", tone: "" },
  { status: "cancelled", tone: "red" },
];

/** Read-only growth report: every figure is derived from authorized store records. */
export default function AdminAnalyticsPage() {
  const { state } = useDemo();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [refunds, setRefunds] = useState<ServerMetrics>({
    processedRefunds: 0,
    processedRefundCount: 0,
    pendingRefundCount: 0,
    paidRevenue: 0,
    paidOrderCount: 0,
    costOfGoods: 0,
    grossMargin: 0,
    grossMarginRate: 0,
    paymentSuccessRate: 0,
    paymentAttempts: 0,
    stockouts: 0,
    newCustomers: 0,
    returningCustomers: 0,
    comparisonRevenuePct: null,
    topProducts: [],
    cohorts: [],
  });
  useEffect(() => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    void api<ServerMetrics>(`/api/admin/analytics?${query}`).then(setRefunds);
  }, [from, to]);

  const inPeriod = (value: string) => {
    const time = Date.parse(value);
    return (
      (!from || time >= Date.parse(`${from}T00:00:00Z`)) &&
      (!to || time < Date.parse(`${to}T00:00:00Z`) + 86_400_000)
    );
  };
  const periodOrders = state.orders.filter((order) => inPeriod(order.placedAt));
  const periodSourcing = state.sourcing.filter((request) =>
    inPeriod(request.submittedAt),
  );
  const periodReturns = state.returns.filter((request) =>
    inPeriod(request.createdAt),
  );

  const paidOrders = periodOrders.filter((order) =>
    ["paid", "refunded"].includes(order.paymentStatus),
  );
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const netRevenue = Math.max(0, paidRevenue - refunds.processedRefunds);
  const averagePaidOrder = paidOrders.length
    ? Math.round(paidRevenue / paidOrders.length)
    : 0;

  const convertedRequests = periodSourcing.filter(
    (request) => request.status === "converted",
  );
  const conversionRate = periodSourcing.length
    ? Math.round((convertedRequests.length / periodSourcing.length) * 100)
    : 0;
  const pendingPaymentAmount = periodOrders
    .filter((order) => order.paymentStatus === "pending")
    .reduce((sum, order) => sum + order.total, 0);
  const returnRate = paidOrders.length
    ? Math.round((periodReturns.length / paidOrders.length) * 100)
    : 0;

  const ordersPerCustomer = new Map<string, number>();
  for (const order of paidOrders) {
    ordersPerCustomer.set(
      order.customerId,
      (ordersPerCustomer.get(order.customerId) ?? 0) + 1,
    );
  }
  const repeatCustomers = state.customers.filter(
    (customer) => (ordersPerCustomer.get(customer.id) ?? 0) > 1,
  ).length;

  // Paid revenue bucketed by the month each order was placed.
  const revenueByMonth = new Map<string, number>();
  for (const order of paidOrders) {
    const bucket = order.placedAt.slice(0, 7);
    revenueByMonth.set(bucket, (revenueByMonth.get(bucket) ?? 0) + order.total);
  }
  const months = [...revenueByMonth.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const peakMonth = months.reduce((max, [, sum]) => Math.max(max, sum), 0);

  const fulfillmentCounts = new Map<FulfillmentStatus, number>();
  for (const order of periodOrders) {
    fulfillmentCounts.set(
      order.fulfillmentStatus,
      (fulfillmentCounts.get(order.fulfillmentStatus) ?? 0) + 1,
    );
  }

  // Top categories by item count across paid/refunded order lines only.
  const categoryItems = new Map<string, number>();
  const categoryRevenue = new Map<string, number>();
  const categoryOrders = new Map<string, Set<string>>();
  for (const order of paidOrders) {
    for (const item of order.items) {
      categoryItems.set(
        item.categorySlug,
        (categoryItems.get(item.categorySlug) ?? 0) + 1,
      );
      categoryRevenue.set(
        item.categorySlug,
        (categoryRevenue.get(item.categorySlug) ?? 0) +
          item.unitPrice * item.quantity,
      );
      const seen = categoryOrders.get(item.categorySlug) ?? new Set<string>();
      seen.add(order.id);
      categoryOrders.set(item.categorySlug, seen);
    }
  }
  const totalItems = [...categoryItems.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const topCategories = [...categoryItems.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Vendor workload: how many vendor groups each vendor carries across orders.
  const vendorGroups = new Map<string, number>();
  const vendorOpenGroups = new Map<string, number>();
  const vendorOrders = new Map<string, Set<string>>();
  for (const order of periodOrders) {
    for (const group of order.vendorGroups) {
      vendorGroups.set(
        group.vendorId,
        (vendorGroups.get(group.vendorId) ?? 0) + 1,
      );
      if (!["closed", "blocked"].includes(group.stage)) {
        vendorOpenGroups.set(
          group.vendorId,
          (vendorOpenGroups.get(group.vendorId) ?? 0) + 1,
        );
      }
      const seen = vendorOrders.get(group.vendorId) ?? new Set<string>();
      seen.add(order.id);
      vendorOrders.set(group.vendorId, seen);
    }
  }
  const totalVendorGroups = [...vendorGroups.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const vendorRows = [...vendorGroups.entries()].sort((a, b) => b[1] - a[1]);
  const vendorName = (vendorId: string) =>
    state.vendors.find((vendor) => vendor.id === vendorId)?.name ?? vendorId;

  const categoryName = (slug: string) =>
    state.categories.find((category) => category.slug === slug)?.name ?? slug;

  return (
    <>
      <AdminPageHeader
        eyebrow="Insight"
        title="Analytics"
        description={`${plural(
          state.orders.length,
          "order",
        )} · ${plural(paidOrders.length, "paid order")} · ${plural(
          state.sourcing.length,
          "sourcing request",
        )} — every figure below is computed from those records`}
        action={
          <>
            <a
              className="admin-btn secondary"
              href={`/api/admin/analytics?format=csv${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
            >
              Export report
            </a>
            <Link className="admin-btn quiet" href="/admin">
              Dashboard
            </Link>
          </>
        }
      />

      <div className="admin-filters">
        <label>
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button
          className="admin-btn quiet"
          type="button"
          onClick={() => {
            setFrom("");
            setTo("");
          }}
        >
          All time
        </button>
      </div>

      <AdminKpis
        items={[
          {
            label: "Paid revenue",
            value: money(paidRevenue),
            note: "Sum of orders marked paid",
          },
          {
            label: "Processed refunds",
            value: money(refunds.processedRefunds),
            note: `${refunds.processedRefundCount} processed · ${refunds.pendingRefundCount} pending`,
          },
          {
            label: "Net revenue",
            value: money(netRevenue),
            note: "Gross paid revenue minus processed refunds",
          },
          {
            label: "Average paid order",
            value: money(averagePaidOrder),
            note: "Paid total ÷ paid orders",
          },
          {
            label: "Pending payment amount",
            value: money(pendingPaymentAmount),
            note: "Orders awaiting verified payment",
          },
          {
            label: "Return rate",
            value: `${returnRate}%`,
            note: `${periodReturns.length} requests ÷ ${paidOrders.length} paid orders`,
          },
          {
            label: "Sourcing conversion",
            value: `${conversionRate}%`,
            note: `${convertedRequests.length} of ${periodSourcing.length} requests converted`,
          },
          {
            label: "Repeat customers",
            value: repeatCustomers,
            note: `of ${state.customers.length} profiles`,
          },
          {
            label: "Paid revenue per customer",
            value: money(
              Math.round(paidRevenue / (state.customers.length || 1)),
            ),
            note: "Paid revenue ÷ customers",
          },
          {
            label: "Gross margin",
            value: money(refunds.grossMargin),
            note: `${refunds.grossMarginRate}% after product cost`,
          },
          {
            label: "Payment success",
            value: `${refunds.paymentSuccessRate}%`,
            note: `${refunds.paymentAttempts} payment attempts`,
          },
          {
            label: "Stockouts",
            value: refunds.stockouts,
            note: "Variants with zero confirmed stock",
          },
          {
            label: "New / returning",
            value: `${refunds.newCustomers} / ${refunds.returningCustomers}`,
            note:
              refunds.comparisonRevenuePct === null
                ? "Choose both dates for period comparison"
                : `${refunds.comparisonRevenuePct >= 0 ? "+" : ""}${refunds.comparisonRevenuePct}% revenue vs prior period`,
          },
        ]}
      />

      <div className="admin-grid">
        <section>
          <div className="admin-section-title">
            <h2>Revenue by month</h2>
            <span style={{ color: "var(--muted)", fontSize: ".6rem" }}>
              Paid orders only
            </span>
          </div>
          {months.length === 0 ? (
            <AdminEmpty
              title="No paid revenue yet"
              hint="Once an order in the store is marked paid, its total is bucketed into the month it was placed."
            />
          ) : (
            <div
              className="admin-bars"
              role="img"
              aria-label={`Paid revenue by month: ${months
                .map(([bucket, sum]) => `${monthLabel(bucket)} ${money(sum)}`)
                .join(", ")}`}
            >
              {months.map(([bucket, sum]) => {
                const height = Math.max(
                  4,
                  Math.round((sum / (peakMonth || 1)) * 70),
                );
                return (
                  <div key={bucket}>
                    <i
                      style={{ height: `${height}%` }}
                      title={`${monthLabel(bucket)}: ${money(sum)}`}
                    />
                    <span>{compactMoney(sum)}</span>
                    <span>{monthLabel(bucket)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside>
          <h2>Fulfilment status</h2>
          <div className="admin-legend">
            {FULFILMENT_ROWS.map(({ status, tone }) => (
              <div key={status}>
                <span className={tone || undefined}>
                  {fulfillmentStatusMeta[status].label}
                </span>
                <strong>{fulfillmentCounts.get(status) ?? 0}</strong>
              </div>
            ))}
            <div>
              <span className="neutral">All orders</span>
              <strong>{periodOrders.length}</strong>
            </div>
          </div>
          <p
            style={{
              marginTop: "1rem",
              color: "var(--muted)",
              fontSize: ".62rem",
            }}
          >
            Counts are taken straight from each order&apos;s fulfilment status
            in the store.
          </p>
        </aside>
      </div>

      <div className="admin-panels" style={{ marginTop: "1rem" }}>
        <section className="admin-card">
          <h3>Top categories</h3>
          <p>
            Item lines across every order, ranked by how often the category was
            bought.
          </p>
          {topCategories.length === 0 ? (
            <AdminEmpty
              title="No order lines yet"
              hint="Category ranking appears once store records contains orders."
            />
          ) : (
            <AdminTable
              template=".9fr 1.2fr .7fr 1.2fr .8fr"
              head={["Category", "Items", "Revenue", "Orders", "Share"]}
              caption="The five most ordered categories"
            >
              {topCategories.map(([slug, count]) => (
                <div className="table-row" key={slug}>
                  <span style={{ fontWeight: 700 }}>{categoryName(slug)}</span>
                  <span>{count}</span>
                  <span>{money(categoryRevenue.get(slug) ?? 0)}</span>
                  <span>{categoryOrders.get(slug)?.size ?? 0}</span>
                  <span style={{ textAlign: "right" }}>
                    {totalItems ? Math.round((count / totalItems) * 100) : 0}%
                  </span>
                </div>
              ))}
            </AdminTable>
          )}
        </section>

        <section className="admin-card">
          <h3>Vendor workload</h3>
          <p>
            Vendor groups raised across orders; open groups are not yet closed
            or blocked.
          </p>
          {vendorRows.length === 0 ? (
            <AdminEmpty
              title="No vendor groups yet"
              hint="Workload appears once store records contains orders with vendor groups."
            />
          ) : (
            <AdminTable
              template=".9fr 1.2fr .7fr 1.2fr .8fr"
              head={["Vendor", "Groups", "Open", "Orders", "Share"]}
              caption="Vendor groups per vendor across all orders"
            >
              {vendorRows.map(([vendorId, count]) => (
                <div className="table-row" key={vendorId}>
                  <span style={{ fontWeight: 700 }}>
                    {vendorName(vendorId)}
                  </span>
                  <span>{count}</span>
                  <span>{vendorOpenGroups.get(vendorId) ?? 0}</span>
                  <span>{vendorOrders.get(vendorId)?.size ?? 0}</span>
                  <span style={{ textAlign: "right" }}>
                    {totalVendorGroups
                      ? Math.round((count / totalVendorGroups) * 100)
                      : 0}
                    %
                  </span>
                </div>
              ))}
            </AdminTable>
          )}
        </section>
      </div>

      <div className="admin-panels" style={{ marginTop: "1rem" }}>
        <section className="admin-card">
          <h3>Product performance</h3>
          {refunds.topProducts.length ? (
            <AdminTable
              template="1.5fr .7fr 1fr"
              head={["Product", "Units", "Revenue"]}
              caption="Top products by paid revenue in the selected period"
            >
              {refunds.topProducts.map((product) => (
                <div className="table-row" key={product.id}>
                  <span>{product.name}</span>
                  <span>{product.units}</span>
                  <span>{money(product.revenue)}</span>
                </div>
              ))}
            </AdminTable>
          ) : (
            <AdminEmpty
              title="No product performance yet"
              hint="Paid product lines will appear here."
            />
          )}
        </section>

        <section className="admin-card">
          <h3>Customer cohorts and LTV</h3>
          {refunds.cohorts.length ? (
            <AdminTable
              template=".8fr .8fr 1fr 1fr"
              head={["Joined", "Customers", "Revenue", "LTV"]}
              caption="Selected-period paid revenue grouped by customer join month"
            >
              {refunds.cohorts.map((cohort) => (
                <div className="table-row" key={cohort.cohort}>
                  <span>{cohort.cohort}</span>
                  <span>{cohort.customers}</span>
                  <span>{money(cohort.revenue)}</span>
                  <span>{money(cohort.ltv)}</span>
                </div>
              ))}
            </AdminTable>
          ) : (
            <AdminEmpty
              title="No cohort data yet"
              hint="Cohorts appear after customers have paid orders."
            />
          )}
        </section>
      </div>

      <div className="admin-note" style={{ marginTop: "1.5rem" }}>
        All figures come from the store records managed by your team — orders,
        sourcing requests, customers and vendor groups seeded by the app.
        Nothing is sent to an analytics service, and no number here is a live
        business measurement.
      </div>
    </>
  );
}
