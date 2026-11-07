"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { rememberIntent } from "@/lib/intent";
import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import { HeartIcon, MinusIcon, PlusIcon, StarIcon } from "@/components/icons";
import { money, percentOff, plural } from "@/lib/format";
import { availabilityMeta } from "@/lib/status";
import { useDemo } from "@/lib/store";
import { visibleProducts } from "@/lib/catalog";
import { toViewerProducts } from "@/lib/catalog-dto";

const MAX_QUANTITY = 10;

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const { state, actions } = useDemo();
  const signedIn = Boolean(state.customerSession);

  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const product = state.products.find((item) => item.slug === slug);

  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  if (!product || product.status !== "published" || product.restricted)
    notFound();

  const category = state.categories.find(
    (item) => item.slug === product.categorySlug,
  );
  const variant =
    product.variants.find((item) => item.id === variantId) ??
    product.variants[0];
  const availability = availabilityMeta[variant.availability];
  const discount = percentOff(variant.price, variant.compareAt);
  const soldOut = variant.availability === "out_of_stock";
  const saved = state.wishlist.includes(product.id);

  // Guest-accessible page: the related strip receives viewer-scoped DTOs so an
  // anonymous visitor's bundle carries no monetary fields for these either.
  const related = toViewerProducts(
    visibleProducts(state.products)
      .filter(
        (item) =>
          item.categorySlug === product.categorySlug && item.id !== product.id,
      )
      .slice(0, 5),
    { pricesVisible: signedIn },
  );

  return (
    <div className="wrap product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/shop">Shop</Link>
        <span>/</span>
        {category ? (
          <>
            <Link href={`/category/${category.slug}`}>{category.name}</Link>
            <span>/</span>
          </>
        ) : null}
        <strong>{product.name}</strong>
      </nav>

      <div className="pdp">
        <div className="pdp-gallery">
          <Image
            src={product.images[activeImage] ?? product.images[0]}
            alt={product.name}
            width={900}
            height={900}
            priority
            sizes="(max-width: 600px) 100vw, 50vw"
          />
          <div>
            {product.images.map((image, index) => (
              <button
                key={image}
                type="button"
                aria-label={`View image ${index + 1}`}
                aria-pressed={index === activeImage}
                onClick={() => setActiveImage(index)}
              >
                <Image src={image} alt="" width={90} height={90} />
              </button>
            ))}
          </div>
        </div>

        <div className="pdp-info">
          <span className="eyebrow">
            {category?.name ?? product.categorySlug} · {product.brand}
          </span>
          <h1>{product.name}</h1>

          <p className="pdp-rating">
            <StarIcon /> {product.rating.toFixed(1)} ·{" "}
            {plural(product.reviewCount, "review")}
          </p>

          {signedIn ? (
            <div className="pdp-price">
              {money(variant.price)}
              {variant.compareAt ? <del>{money(variant.compareAt)}</del> : null}
              {discount ? (
                <span className="pdp-off">Save {discount}%</span>
              ) : null}
            </div>
          ) : (
            <div className="pdp-price">
              <Link
                href="/login"
                onClick={() =>
                  rememberIntent({
                    path: `/product/${slug}`,
                    productId: product.id,
                    variantId: variant.id,
                    quantity,
                  })
                }
              >
                Sign in to view price
              </Link>
            </div>
          )}

          <p className="pdp-note">
            <strong>{availability.label}.</strong> {availability.hint}
          </p>

          {product.variants.length > 1 ? (
            <div className="variant">
              <strong>Choose an option</strong>
              <div>
                {product.variants.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={option.id === variant.id ? "active" : undefined}
                    aria-pressed={option.id === variant.id}
                    onClick={() => setVariantId(option.id)}
                  >
                    {option.label}
                    {option.availability === "out_of_stock"
                      ? " · out of stock"
                      : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="purchase-row">
            {signedIn ? (
              <>
                <div className="quantity">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      setQuantity((value) => Math.max(1, value - 1))
                    }
                  >
                    <MinusIcon />
                  </button>
                  <span aria-live="polite">{quantity}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQuantity((value) => Math.min(MAX_QUANTITY, value + 1))
                    }
                  >
                    <PlusIcon />
                  </button>
                </div>

                {soldOut ? (
                  <Link
                    className="pdp-add"
                    href={`/request-product?product=${encodeURIComponent(product.name)}`}
                  >
                    Request this product
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="pdp-add"
                    onClick={() =>
                      actions.addToCart(product.id, variant.id, quantity)
                    }
                  >
                    Add to cart · {money(variant.price * quantity)}
                  </button>
                )}
              </>
            ) : (
              <Link
                className="pdp-add"
                href={`/login?next=${encodeURIComponent(`/product/${slug}`)}`}
              >
                Sign in to shop
              </Link>
            )}

            <button
              type="button"
              className="pdp-wish"
              aria-pressed={saved}
              aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
              onClick={() => actions.toggleWishlist(product.id)}
            >
              <HeartIcon />
            </button>
          </div>

          <div className="pdp-assurance">
            <p>
              <strong>Availability</strong>
              <br />
              {availability.label} — Paydan confirms supplier stock before
              dispatch.
            </p>
            <p>
              <strong>Delivery</strong>
              <br />
              Estimated by state at checkout, confirmed per supplier.
            </p>
            <p>
              <strong>Returns</strong>
              <br />
              Request a return from your account; each request is reviewed.
            </p>
            <p>
              <strong>Support</strong>
              <br />
              {state.settings.supportEmail}
            </p>
          </div>
        </div>
      </div>

      <section className="pdp-details">
        <div>
          <h2>About this product</h2>
          <p>{product.description}</p>
          <ul>
            {product.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>

        <dl>
          {Object.entries(product.specifications).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {related.length ? (
        <section className="section">
          <div className="section-heading">
            <h2>More from {category?.name ?? "this department"}</h2>
            {category ? (
              <Link href={`/category/${category.slug}`}>View department</Link>
            ) : null}
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                categoryName={category?.name}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
