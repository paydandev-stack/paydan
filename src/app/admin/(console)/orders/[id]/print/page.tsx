"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { formatDate, formatDateTime, money } from "@/lib/format";

export default function OrderPrintPage() {
  const params = useParams<{ id: string }>();
  const { state } = useDemo();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const order = state.orders.find((item) => item.id === id);
  const [type, setType] = useState<"invoice" | "packing">("invoice");
  useEffect(() => {
    setType(
      new URLSearchParams(window.location.search).get("type") === "packing"
        ? "packing"
        : "invoice",
    );
  }, []);
  if (!order) notFound();
  const supplierNames = [
    ...new Set(order.vendorGroups.map((group) => group.vendorId)),
  ].map(
    (vendorId) =>
      state.vendors.find((vendor) => vendor.id === vendorId)?.name || vendorId,
  );

  return (
    <div className="print-sheet">
      <div className="print-actions">
        <Link className="admin-btn quiet" href={"/admin/orders/" + order.id}>
          Back to order
        </Link>
        <button
          className="admin-btn"
          type="button"
          onClick={() => window.print()}
        >
          Print {type}
        </button>
      </div>
      <header className="print-header">
        <div>
          <strong>PAYDAN</strong>
          <span>{type === "invoice" ? "Order invoice" : "Packing slip"}</span>
        </div>
        <div>
          <b>{order.reference}</b>
          <span>Placed {formatDateTime(order.placedAt)}</span>
          <span>Payment: {order.paymentStatus}</span>
          <span>Tracking: {order.trackingCode || "Pending"}</span>
        </div>
      </header>

      <section className="print-block">
        <h2>{type === "invoice" ? "Billed to" : "Deliver to"}</h2>
        <p>
          {order.customerName}
          <br />
          {order.customerEmail}
          <br />
          {order.customerPhone}
          <br />
          {order.address.recipient}
          <br />
          {order.address.street}
          {order.address.landmark ? ", " + order.address.landmark : ""}
          <br />
          {order.address.city}, {order.address.state}
        </p>
      </section>

      <table className="print-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU / variant</th>
            <th>Qty</th>
            {type === "invoice" ? <th>Unit price</th> : null}
            {type === "invoice" ? <th>Line total</th> : null}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={item.productId + "-" + index}>
              <td>{item.name}</td>
              <td>
                {item.sku || "—"}
                <br />
                {item.variantLabel}
              </td>
              <td>{item.quantity}</td>
              {type === "invoice" ? <td>{money(item.unitPrice)}</td> : null}
              {type === "invoice" ? (
                <td>{money(item.unitPrice * item.quantity)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {type === "invoice" ? (
        <section className="print-totals">
          <div>
            <span>Subtotal</span>
            <b>{money(order.subtotal)}</b>
          </div>
          <div>
            <span>Delivery</span>
            <b>{money(order.deliveryFee)}</b>
          </div>
          <div>
            <span>Discount</span>
            <b>{money(order.discount)}</b>
          </div>
          <div>
            <span>Total</span>
            <b>{money(order.total)}</b>
          </div>
        </section>
      ) : (
        <section className="print-block">
          <h2>Handling notes</h2>
          <p>
            Supplier groups:{" "}
            {supplierNames.length ? supplierNames.join(", ") : "Store stock"}
            <br />
            Printed {formatDate(new Date().toISOString())}. Pack only the
            quantities listed above.
          </p>
        </section>
      )}
    </div>
  );
}
