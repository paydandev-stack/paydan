"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import { AdminEmpty, AdminTable } from "@/components/admin/data-table";
import type { FulfillmentStatus } from "@/lib/types";
import { compactMoney, money, plural } from "@/lib/format";
import { fulfillmentStatusMeta } from "@/lib/status";

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

  const paidOrders = state.orders.filter(
    (order) => order.paymentStatus === "paid",
  );
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const averagePaidOrder = paidOrders.length
    ? Math.round(paidRevenue / paidOrders.length)
    : 0;

  const convertedRequests = state.sourcing.filter(
    (request) => request.status === "converted",
  );
  const conversionRate = state.sourcing.length
    ? Math.round((convertedRequests.length / state.sourcing.length) * 100)
    : 0;

  const ordersPerCustomer = new Map<string, number>();
  for (const order of state.orders) {
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
  for (const order of state.orders) {
    fulfillmentCounts.set(
      order.fulfillmentStatus,
      (fulfillmentCounts.get(order.fulfillmentStatus) ?? 0) + 1,
    );
  }

  // Top categories by item count across every order line.
  const categoryItems = new Map<string, number>();
  const categoryRevenue = new Map<string, number>();
  const categoryOrders = new Map<string, Set<string>>();
  for (const order of state.orders) {
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
  for (const order of state.orders) {
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
          <Link className="admin-btn quiet" href="/admin">
            Dashboard
          </Link>
        }
      />

      <AdminKpis
        items={[
          {
            label: "Paid revenue",
            value: money(paidRevenue),
            note: "Sum of orders marked paid",
          },
          {
            label: "Total orders",
            value: state.orders.length,
            note: `${paidOrders.length} marked paid`,
          },
          {
            label: "Average paid order",
            value: money(averagePaidOrder),
            note: "Paid total ÷ paid orders",
          },
          {
            label: "Sourcing conversion",
            value: `${conversionRate}%`,
            note: `${convertedRequests.length} of ${state.sourcing.length} requests converted`,
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
              <strong>{state.orders.length}</strong>
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

      <div className="admin-note" style={{ marginTop: "1.5rem" }}>
        All figures come from the store records managed by your team — orders,
        sourcing requests, customers and vendor groups seeded by the app.
        Nothing is sent to an analytics service, and no number here is a live
        business measurement.
      </div>
    </>
  );
}
