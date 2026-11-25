import { VendorShell } from "@/components/vendor/vendor-shell";
import { formatDateTime, money } from "@/lib/format";
import { getVendorSnapshot } from "@/server/vendor";
import { requireVendorPage } from "@/server/vendor-page";

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function VendorOrdersPage() {
  const user = await requireVendorPage();
  const snapshot = await getVendorSnapshot(user);
  const active = snapshot.orders.filter(
    (order) => !["delivered", "completed", "cancelled"].includes(order.stage),
  );

  return (
    <VendorShell
      active="orders"
      vendorName={snapshot.vendor.name}
      email={user.email}
    >
      <div className="vendor-page">
        <div className="vendor-page-heading">
          <div>
            <span className="vendor-kicker">FULFILMENT</span>
            <h1>Order queue</h1>
            <p>
              Every order group PAYDAN has routed to {snapshot.vendor.name},
              newest first.
            </p>
          </div>
          <div className="vendor-inline-stat">
            <strong>{active.length}</strong>
            <span>Active assignments</span>
          </div>
        </div>

        <section className="vendor-panel">
          <div className="vendor-panel-head">
            <div>
              <h2>Assigned orders</h2>
              <p>{snapshot.orders.length} vendor groups in total</p>
            </div>
          </div>
          {snapshot.orders.length ? (
            <div className="vendor-table-scroll">
              <table className="vendor-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Placed</th>
                    <th>Items</th>
                    <th>Stage</th>
                    <th>ETA</th>
                    <th className="right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.orders.map((order, index) => (
                    <tr key={order.id + index}>
                      <td>
                        <strong>{order.reference}</strong>
                        <small>{label(order.paymentStatus)}</small>
                      </td>
                      <td>{order.customerName}</td>
                      <td>{formatDateTime(order.placedAt)}</td>
                      <td>{order.itemCount}</td>
                      <td>
                        <span className="vendor-tag">{label(order.stage)}</span>
                      </td>
                      <td>{order.eta || "To be confirmed"}</td>
                      <td className="right">{money(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="vendor-empty">
              <strong>No order assignments yet</strong>
              <p>
                When a customer buys one of your products, the vendor group will
                appear here with its fulfilment stage.
              </p>
            </div>
          )}
        </section>
      </div>
    </VendorShell>
  );
}
