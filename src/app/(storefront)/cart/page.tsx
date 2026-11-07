"use client";
import Image from "@/components/safe-image";
import Link from "next/link";
import { useDemo } from "@/lib/store";
import { deliveryEtaFor, deliveryFeeFor } from "@/lib/catalog";
import { money, plural } from "@/lib/format";
import { CartIcon, MinusIcon, PlusIcon } from "@/components/icons";
export default function CartPage() {
  const { state, actions } = useDemo();
  const signedIn = Boolean(state.customerSession);
  const lines = state.cart.flatMap((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    const variant = product?.variants.find(
      (item) => item.id === line.variantId,
    );
    if (!product || !variant) return [];
    return [{ line, product, variant }];
  });
  const savedLines = state.savedForLater.flatMap((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    const variant = product?.variants.find(
      (item) => item.id === line.variantId,
    );
    if (!product || !variant) return [];
    return [{ line, product, variant }];
  });
  const subtotal = lines.reduce(
    (sum, item) => sum + item.variant.price * item.line.quantity,
    0,
  );
  const delivery = deliveryFeeFor(state.location.state, state.shippingZones);
  const total = subtotal + (delivery ?? 0);
  const itemCount = lines.reduce((sum, item) => sum + item.line.quantity, 0);
  const categoryName = (slug: string) =>
    state.categories.find((category) => category.slug === slug)?.name ?? "";
  return (
    <div className="wrap">
      <div className="flow-heading" style={{ paddingTop: "2.5rem" }}>
        <h1>Your cart</h1>
        <p>
          {lines.length
            ? `${plural(itemCount, "item")} ready to review. Availability is confirmed with each supplier before dispatch.`
            : "Your cart is empty."}
        </p>
      </div>

      {lines.length === 0 ? (
        <div className="empty" style={{ marginBottom: "4rem" }}>
          <CartIcon />
          <h3>Nothing in your cart yet</h3>
          <p>
            Browse the departments or start with what is on offer this month.
          </p>
          <Link href="/shop">Shop all products</Link>
        </div>
      ) : (
        <div className="cart-layout" style={{ paddingBottom: "5rem" }}>
          <div>
            <div className="cart-lines">
              {lines.map(({ line, product, variant }) => (
                <article key={`${product.id}-${variant.id}`}>
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    width={112}
                    height={112}
                    sizes="112px"
                  />
                  <div>
                    <span>{categoryName(product.categorySlug)}</span>
                    <h2>
                      <Link href={`/product/${product.slug}`}>
                        {product.name}
                      </Link>
                    </h2>
                    <p>
                      {signedIn
                        ? `${variant.label} · ${money(variant.price)} each`
                        : variant.label}
                    </p>
                    <button
                      type="button"
                      className="save-later"
                      onClick={async () => {
                        try {
                          return await actions.saveForLater(
                            product.id,
                            variant.id,
                          );
                        } catch (error) {}
                      }}
                    >
                      Save for later
                    </button>
                    <button
                      type="button"
                      onClick={() => actions.removeLine(product.id, variant.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="line-end">
                    <div className="quantity">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${product.name}`}
                        onClick={async () => {
                          try {
                            return await actions.setQuantity(
                              product.id,
                              variant.id,
                              line.quantity - 1,
                            );
                          } catch (error) {}
                        }}
                      >
                        <MinusIcon />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${product.name}`}
                        onClick={async () => {
                          try {
                            return await actions.setQuantity(
                              product.id,
                              variant.id,
                              line.quantity + 1,
                            );
                          } catch (error) {}
                        }}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                    {signedIn ? (
                      <strong>{money(variant.price * line.quantity)}</strong>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {savedLines.length ? (
              <section className="saved-lines">
                <h2>Saved for later</h2>
                {savedLines.map(({ line, product, variant }) => (
                  <div key={`${product.id}-${variant.id}`}>
                    <span>
                      {product.name} · {variant.label}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          return await actions.moveToCart(
                            product.id,
                            variant.id,
                          );
                        } catch (error) {}
                      }}
                    >
                      Move to cart
                    </button>
                  </div>
                ))}
              </section>
            ) : null}

            <p className="cart-continue">
              <Link href="/shop">Continue shopping</Link>
            </p>
          </div>

          <aside className="order-summary">
            <h2>Order summary</h2>
            {signedIn ? (
              <>
                <div>
                  <span>Subtotal</span>
                  <strong>{money(subtotal)}</strong>
                </div>
                <div>
                  <span>Delivery to {state.location.state}</span>
                  <strong>
                    {delivery === null ? "Confirmed later" : money(delivery)}
                  </strong>
                </div>
                <div>
                  <span>Delivery estimate</span>
                  <strong>
                    {deliveryEtaFor(state.location.state, state.shippingZones)}
                  </strong>
                </div>
                <hr />
                <div className="total">
                  <span>Estimated total</span>
                  <strong>{money(total)}</strong>
                </div>
                <Link href="/checkout">Proceed to checkout</Link>
                <small>
                  Delivery is an estimate for {state.location.state}. The final
                  fee is confirmed at checkout before you continue to Paystack.
                </small>
              </>
            ) : (
              <>
                <div>
                  <span>Prices and totals</span>
                  <strong>Sign in to view</strong>
                </div>
                <div>
                  <span>Delivery estimate</span>
                  <strong>
                    {deliveryEtaFor(state.location.state, state.shippingZones)}
                  </strong>
                </div>
                <Link href={`/login?next=${encodeURIComponent("/cart")}`}>
                  Sign in to check out
                </Link>
                <small>
                  Your selection is saved in this browser as an unpriced draft.
                  Sign in to see prices, totals and payment options.
                </small>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
