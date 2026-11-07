"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
import { useDemo } from "@/lib/store";
import { money, percentOff } from "@/lib/format";
import { availabilityMeta } from "@/lib/status";
import { HeartIcon } from "@/components/icons";
import { pricesVisible, type CatalogProduct } from "@/lib/catalog-dto";

type ProductCardProps = {
  /** Built by `toPublicProduct`/`toMemberProduct`, never a raw seed record. */
  product: CatalogProduct;
  /** Department name shown as the card eyebrow. */
  categoryName?: string;
  /**
   * Whether this surface is allowed to show money at all. The homepage passes
   * false — its listings stay price-free even for signed-in members, whose CTA
   * becomes "View product" instead of a card-level purchase action.
   */
  showPrice?: boolean;
};

/**
 * Storefront product tile.
 *
 * The card never receives `costPrice`/`vendorId` (the DTOs do not carry them),
 * and it only renders a price when the DTO was built for a signed-in viewer
 * *and* the surface allows one. Guests get a sign-in action instead.
 */
export function ProductCard({
  product,
  categoryName,
  showPrice = true,
}: ProductCardProps) {
  const { state, actions } = useDemo();

  const signedIn = Boolean(state.customerSession);
  const saved = state.wishlist.includes(product.id);
  const discount = pricesVisible(product)
    ? percentOff(product.price, product.compareAt)
    : undefined;
  const availability = availabilityMeta[product.availability];
  const soldOut = product.availability === "out_of_stock";
  const variant = product.variants.find(
    (item) => item.availability !== "out_of_stock",
  );
  const canShowPrice = showPrice && signedIn && pricesVisible(product);

  return (
    <article className="product-card">
      <div className="product-image">
        {canShowPrice && discount ? (
          <span className="tag">-{discount}%</span>
        ) : null}
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 600px) 45vw, (max-width: 900px) 30vw, 240px"
        />
        <button
          type="button"
          className={`wish${saved ? " active" : ""}`}
          aria-pressed={saved}
          aria-label={
            saved
              ? `Remove ${product.name} from wishlist`
              : `Save ${product.name} to wishlist`
          }
          onClick={() => actions.toggleWishlist(product.id)}
        >
          <HeartIcon />
        </button>
      </div>

      <div className="product-copy">
        <span className="eyebrow">{categoryName ?? product.brand}</span>
        <h3>
          <Link href={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        {canShowPrice ? (
          <div className="price-row">
            <strong>{money(product.price)}</strong>
            {product.compareAt ? <del>{money(product.compareAt)}</del> : null}
          </div>
        ) : null}
        <p className="availability">{availability.label}</p>

        {signedIn ? (
          !showPrice ? (
            // Price-free surfaces (the homepage) never transact from the card.
            <Link className="add" href={`/product/${product.slug}`}>
              View product
            </Link>
          ) : product.variants.length > 1 ? (
            <Link className="add" href={`/product/${product.slug}`}>
              Choose options
            </Link>
          ) : soldOut ? (
            <Link
              className="add"
              href={`/request-product?product=${encodeURIComponent(product.name)}`}
            >
              Request this product
            </Link>
          ) : (
            <button
              type="button"
              className="add"
              disabled={!variant}
              onClick={() =>
                variant && actions.addToCart(product.id, variant.id)
              }
            >
              Add to cart
            </button>
          )
        ) : (
          <Link
            className="add"
            href={`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`}
          >
            Sign in to view price
          </Link>
        )}
      </div>
    </article>
  );
}
