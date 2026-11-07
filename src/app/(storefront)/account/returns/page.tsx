"use client";
import { useState, type FormEvent } from "react";
import { MediaUpload } from "@/components/media-upload";
import { useDemo } from "@/lib/store";
import { formatDate, plural } from "@/lib/format";
import { returnReasons, returnStatusMeta } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";
export default function AccountReturnsPage() {
  const { state, actions } = useDemo();
  const session = state.customerSession;
  const orders = state.orders.filter(
    (order) =>
      order.customerId === session?.id &&
      order.paymentStatus === "paid" &&
      order.fulfillmentStatus === "delivered",
  );
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState(returnReasons[0]);
  const [detail, setDetail] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState("");
  if (!session) return null;
  const selectedOrder = orders.find((order) => order.id === orderId);
  const requests = state.returns.filter(
    (request) => request.customerId === session.id,
  );
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      if (!selectedOrder) {
        setError("Choose the order you want to return an item from.");
        return;
      }
      const itemId = productId || selectedOrder.items[0]?.productId;
      if (!itemId) {
        setError("This order has no items to return.");
        return;
      }
      await actions.createReturn({
        orderId: selectedOrder.id,
        productId: itemId,
        quantity: Math.max(1, Number(quantity) || 1),
        reason,
        detail: detail.trim(),
        images,
      });
      setDetail("");
      setImages([]);
      setQuantity("1");
      setError("");
    } catch (error) {}
  }
  return (
    <>
      <h1>Returns</h1>
      <p style={{ color: "var(--muted)", fontSize: ".75rem" }}>
        Submit a request and Paydan reviews it. Submitting does not
        automatically approve a return.
      </p>

      {orders.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: ".74rem" }}>
          You need an order before requesting a return.
        </p>
      ) : (
        <form
          className="checkout-card"
          style={{ marginTop: "1.5rem" }}
          onSubmit={handleSubmit}
        >
          <h2>Request a return</h2>
          <MediaUpload
            purpose="return"
            onUploaded={(url) =>
              setImages((current) => [...current, url].slice(0, 5))
            }
          />
          <p>{images.length} evidence images attached.</p>
          <div className="form-grid">
            <label className="wide">
              Order
              <select
                value={orderId}
                onChange={(event) => {
                  setOrderId(event.target.value);
                  setProductId("");
                }}
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.reference} · {formatDate(order.placedAt)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Item
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                {selectedOrder?.items.map((item) => (
                  <option key={item.productId} value={item.productId}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <label className="wide">
              Reason
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {returnReasons.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              What happened?
              <textarea
                rows={4}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                style={{
                  padding: ".7rem",
                  border: "1px solid var(--border)",
                  borderRadius: ".4rem",
                  font: "inherit",
                }}
              />
            </label>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="form-actions">
            <button type="submit" className="primary">
              Submit return request
            </button>
          </div>
        </form>
      )}

      <h2>Your requests</h2>
      {requests.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: ".74rem" }}>
          No return requests yet.
        </p>
      ) : (
        <div className="account-items">
          {requests.map((request) => (
            <div className="account-group" key={request.id}>
              <div>
                <strong>{request.reference}</strong>
                <small>
                  {request.productName} · {plural(request.quantity, "unit")} ·{" "}
                  {request.reason}
                </small>
              </div>
              <StatusPill tone={returnStatusMeta[request.status].tone}>
                {returnStatusMeta[request.status].label}
              </StatusPill>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
