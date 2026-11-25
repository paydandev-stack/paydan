import Link from "next/link";
import { VendorShell } from "@/components/vendor/vendor-shell";
import { formatDate, money } from "@/lib/format";
import { getVendorSnapshot } from "@/server/vendor";
import { requireVendorPage } from "@/server/vendor-page";

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function VendorOverviewPage() {
  const user = await requireVendorPage();
  const snapshot = await getVendorSnapshot(user);
  const liveProducts = snapshot.products.filter(
    (product) => product.status === "published",
  );
  const lowStock = snapshot.products.filter((product) => product.stock < 10);
  const pending = snapshot.orders.filter(
    (order) => order.stage !== "delivered" && order.stage !== "completed",
  );

  return (
    <VendorShell
      active="overview"
      vendorName={snapshot.vendor.name}
      email={user.email}
    >
      <div className="vendor-page">
        <div className="vendor-page-heading">
          <div>
            <span className="vendor-kicker">SUPPLIER OVERVIEW</span>
            <h1>Welcome, {snapshot.vendor.name}.</h1>
            <p>
              Here is what is happening across your catalogue and PAYDAN order
              queue today.
            </p>
          </div>
          <Link className="vendor-primary" href="/vendor/products">
            Manage catalogue <span aria-hidden="true">→</span>
          </Link>
        </div>

        <section className="vendor-stat-grid" aria-label="Supplier summary">
          <article>
            <small>Products assigned</small>
            <strong>{snapshot.products.length}</strong>
            <span>{liveProducts.length} published to the storefront</span>
          </article>
          <article>
            <small>Order assignments</small>
            <strong>{snapshot.orders.length}</strong>
            <span>{pending.length} awaiting completion</span>
          </article>
          <article>
            <small>Low stock lines</small>
            <strong>{lowStock.length}</strong>
            <span>Products with fewer than 10 units</span>
          </article>
          <article>
            <small>Order value visible</small>
            <strong>
              {money(
                snapshot.orders.reduce((sum, order) => sum + order.total, 0),
              )}
            </strong>
            <span>Across assigned vendor groups</span>
          </article>
        </section>

        <div className="vendor-two-column">
          <section className="vendor-panel">
            <div className="vendor-panel-head">
              <div>
                <h2>Latest order assignments</h2>
                <p>Requests routed to {snapshot.vendor.name}</p>
              </div>
              <Link href="/vendor/orders">View all</Link>
            </div>
            {snapshot.orders.length ? (
              <div className="vendor-list">
                {snapshot.orders.slice(0, 5).map((order, index) => (
                  <div className="vendor-list-row" key={order.id + index}>
                    <span className="vendor-list-mark" aria-hidden="true">
                      {order.reference.slice(-2)}
                    </span>
                    <div>
                      <strong>{order.reference}</strong>
                      <small>
                        {order.customerName} · {formatDate(order.placedAt)}
                      </small>
                    </div>
                    <span className="vendor-tag">{label(order.stage)}</span>
                    <strong className="vendor-list-amount">
                      {money(order.total)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="vendor-empty">
                <strong>No assignments yet</strong>
                <p>
                  New customer orders that include your products will appear
                  here automatically.
                </p>
              </div>
            )}
          </section>

          <section className="vendor-panel">
            <div className="vendor-panel-head">
              <div>
                <h2>Catalogue health</h2>
                <p>Products currently assigned to your business</p>
              </div>
              <Link href="/vendor/products">Edit</Link>
            </div>
            {snapshot.products.length ? (
              <div className="vendor-list">
                {snapshot.products.slice(0, 5).map((product) => (
                  <div className="vendor-list-row" key={product.id}>
                    {product.images[0] ? (
                      <img
                        className="vendor-thumb"
                        src={product.images[0]}
                        alt=""
                      />
                    ) : (
                      <span className="vendor-list-mark" aria-hidden="true">
                        {product.name.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <strong>{product.name}</strong>
                      <small>
                        {product.sku} · {product.stock} units in stock
                      </small>
                    </div>
                    <span className="vendor-tag">{label(product.status)}</span>
                    <strong className="vendor-list-amount">
                      {money(product.price)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="vendor-empty">
                <strong>Your catalogue is empty</strong>
                <p>
                  Ask PAYDAN operations to assign products to this supplier
                  account.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </VendorShell>
  );
}
