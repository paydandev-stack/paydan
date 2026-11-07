"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { formatDate, money, plural } from "@/lib/format";
import { fulfillmentStatusMeta, paymentStatusMeta } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";

const filters = [
  { id: "all", label: "All orders" },
  { id: "open", label: "In progress" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export default function AccountOrdersPage() {
  const { state } = useDemo();
  const session = state.customerSession;
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");

  if (!session) return null;

  const orders = state.orders.filter(
    (order) => order.customerId === session.id,
  );
  const visible = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "open")
      return !["delivered", "cancelled"].includes(order.fulfillmentStatus);
    return order.fulfillmentStatus === filter;
  });

  return (
    <>
      <h1>Your orders</h1>

      <div className="filter-chips" style={{ paddingTop: "1rem" }}>
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "active" : undefined}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p
          style={{
            color: "var(--muted)",
            fontSize: ".74rem",
            padding: "2rem 0",
          }}
        >
          No orders in this view.{" "}
          <Link href="/shop" style={{ color: "var(--green)" }}>
            Browse the catalogue
          </Link>
          .
        </p>
      ) : (
        <div className="account-orders">
          {visible.map((order) => (
            <article className="account-order" key={order.id}>
              <div>
                <span>
                  <strong>{order.reference}</strong> ·{" "}
                  {formatDate(order.placedAt)}
                </span>
                <strong>{money(order.total)}</strong>
              </div>
              <p>
                {plural(order.items.length, "item")} ·{" "}
                {plural(order.vendorGroups.length, "supplier group")} ·{" "}
                {order.address.city}, {order.address.state}
              </p>
              <div className="account-order-status">
                <StatusPill tone={paymentStatusMeta[order.paymentStatus].tone}>
                  {paymentStatusMeta[order.paymentStatus].label}
                </StatusPill>
                <StatusPill
                  tone={fulfillmentStatusMeta[order.fulfillmentStatus].tone}
                >
                  {fulfillmentStatusMeta[order.fulfillmentStatus].label}
                </StatusPill>
              </div>
              <Link href={`/account/orders/${order.id}`}>View order</Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
