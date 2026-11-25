import { z } from "zod";
import type { Customer, Order } from "@/lib/types";
import { database, records } from "@/server/db";
import { failure, json, requireCapability, viewer } from "@/server/http";

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET(request: Request) {
  try {
    requireCapability(await viewer(request.headers), "analytics.read");
    const url = new URL(request.url);
    const date = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional();
    const from = date.parse(url.searchParams.get("from") || undefined);
    const to = date.parse(url.searchParams.get("to") || undefined);
    const format = z
      .enum(["json", "csv"])
      .default("json")
      .parse(url.searchParams.get("format") || undefined);
    const fromTime = from ? Date.parse(`${from}T00:00:00.000Z`) : -Infinity;
    const toTime = to
      ? Date.parse(`${to}T00:00:00.000Z`) + 86_400_000
      : Infinity;
    const db = database();
    const [orders, customers, refunds, payments, stockouts] = await Promise.all(
      [
        records<Order>(db, "orders"),
        records<Customer>(db, "customers"),
        db.query(
          `SELECT
          COALESCE(sum(amount_kobo) FILTER (WHERE status='processed'),0)::bigint AS processed_kobo,
          count(*) FILTER (WHERE status='processed')::int AS processed_count,
          count(*) FILTER (WHERE status NOT IN ('processed','failed'))::int AS pending_count
         FROM refund
         WHERE ($1::date IS NULL OR created_at >= $1::date)
           AND ($2::date IS NULL OR created_at < $2::date + interval '1 day')`,
          [from ?? null, to ?? null],
        ),
        db.query(
          `SELECT
          count(*)::int AS attempts,
          count(*) FILTER (WHERE status='paid')::int AS successes
         FROM payment
         WHERE ($1::date IS NULL OR created_at >= $1::date)
           AND ($2::date IS NULL OR created_at < $2::date + interval '1 day')`,
          [from ?? null, to ?? null],
        ),
        db.query(
          "SELECT count(*)::int AS count FROM inventory WHERE available=0",
        ),
      ],
    );
    const paid = orders.filter(
      (order) =>
        ["paid", "refunded"].includes(order.paymentStatus) &&
        Date.parse(order.placedAt) >= fromTime &&
        Date.parse(order.placedAt) < toTime,
    );
    const paidRevenue = paid.reduce((sum, order) => sum + order.total, 0);
    const costOfGoods = paid.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (lineSum, item) => lineSum + item.costPrice * item.quantity,
          0,
        ),
      0,
    );
    const grossMargin = paidRevenue - costOfGoods;
    const productPerformance = new Map<
      string,
      { id: string; name: string; units: number; revenue: number }
    >();
    for (const order of paid)
      for (const item of order.items) {
        const row = productPerformance.get(item.productId) ?? {
          id: item.productId,
          name: item.name,
          units: 0,
          revenue: 0,
        };
        row.units += item.quantity;
        row.revenue += item.unitPrice * item.quantity;
        productPerformance.set(item.productId, row);
      }
    const lifetimePaidByCustomer = new Map<string, number>();
    for (const order of orders)
      if (["paid", "refunded"].includes(order.paymentStatus))
        lifetimePaidByCustomer.set(
          order.customerId,
          (lifetimePaidByCustomer.get(order.customerId) ?? 0) + 1,
        );
    const periodCustomerIds = new Set(paid.map((order) => order.customerId));
    const returningCustomers = [...periodCustomerIds].filter(
      (id) => (lifetimePaidByCustomer.get(id) ?? 0) > 1,
    ).length;
    const newCustomers = Math.max(
      0,
      periodCustomerIds.size - returningCustomers,
    );
    const customerRevenue = new Map<string, number>();
    for (const order of paid)
      customerRevenue.set(
        order.customerId,
        (customerRevenue.get(order.customerId) ?? 0) + order.total,
      );
    const customerById = new Map(
      customers.map((customer) => [customer.id, customer]),
    );
    const cohorts = new Map<
      string,
      { customers: Set<string>; revenue: number }
    >();
    for (const [customerId, revenue] of customerRevenue) {
      const joined =
        customerById.get(customerId)?.joinedAt?.slice(0, 7) || "Unknown";
      const cohort = cohorts.get(joined) ?? {
        customers: new Set<string>(),
        revenue: 0,
      };
      cohort.customers.add(customerId);
      cohort.revenue += revenue;
      cohorts.set(joined, cohort);
    }
    let comparisonRevenuePct: number | null = null;
    if (Number.isFinite(fromTime) && Number.isFinite(toTime)) {
      const span = toTime - fromTime;
      const previousRevenue = orders
        .filter(
          (order) =>
            ["paid", "refunded"].includes(order.paymentStatus) &&
            Date.parse(order.placedAt) >= fromTime - span &&
            Date.parse(order.placedAt) < fromTime,
        )
        .reduce((sum, order) => sum + order.total, 0);
      comparisonRevenuePct = percentChange(paidRevenue, previousRevenue);
    }
    const attempts = Number(payments.rows[0].attempts ?? 0);
    const metrics = {
      processedRefunds: Number(refunds.rows[0].processed_kobo) / 100,
      processedRefundCount: Number(refunds.rows[0].processed_count),
      pendingRefundCount: Number(refunds.rows[0].pending_count),
      paidRevenue,
      paidOrderCount: paid.length,
      costOfGoods,
      grossMargin,
      grossMarginRate: paidRevenue
        ? Math.round((grossMargin / paidRevenue) * 100)
        : 0,
      paymentSuccessRate: attempts
        ? Math.round((Number(payments.rows[0].successes) / attempts) * 100)
        : 0,
      paymentAttempts: attempts,
      stockouts: Number(stockouts.rows[0].count ?? 0),
      newCustomers,
      returningCustomers,
      comparisonRevenuePct,
      topProducts: [...productPerformance.values()]
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 10),
      cohorts: [...cohorts.entries()]
        .sort((left, right) => right[0].localeCompare(left[0]))
        .map(([cohort, value]) => ({
          cohort,
          customers: value.customers.size,
          revenue: value.revenue,
          ltv: value.customers.size
            ? Math.round(value.revenue / value.customers.size)
            : 0,
        })),
    };
    if (format === "csv") {
      const cells = (values: unknown[]) =>
        values
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",");
      const rows = [
        cells(["metric", "value"]),
        ...Object.entries(metrics)
          .filter(([, value]) => !Array.isArray(value))
          .map(([key, value]) => cells([key, value])),
        "",
        cells(["product", "units", "revenue"]),
        ...metrics.topProducts.map((product) =>
          cells([product.name, product.units, product.revenue]),
        ),
        "",
        cells(["cohort", "customers", "revenue", "ltv"]),
        ...metrics.cohorts.map((cohort) =>
          cells([cohort.cohort, cohort.customers, cohort.revenue, cohort.ltv]),
        ),
      ];
      return new Response(rows.join("\r\n"), {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="paydan-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return json(metrics);
  } catch (error) {
    return failure(error);
  }
}
