"use client";

import Link from "next/link";
import { toMemberProducts } from "@/lib/catalog-dto";
import { useDemo } from "@/lib/store";
import { ProductCard } from "@/components/product-card";
import { HeartIcon } from "@/components/icons";

export default function AccountWishlistPage() {
  const { state } = useDemo();
  if (!state.customerSession) return null;

  // Member-only below the session guard: saved items are a personal surface,
  // so these cards carry prices the way other non-homepage member views do.
  const products = toMemberProducts(
    state.products.filter((product) => state.wishlist.includes(product.id)),
  );

  return (
    <>
      <h1>Wishlist</h1>
      <p style={{ color: "var(--muted)", fontSize: ".75rem" }}>
        Saved products stay here between visits in this browser.
      </p>

      {products.length === 0 ? (
        <div className="empty" style={{ marginTop: "2rem" }}>
          <HeartIcon />
          <h3>Nothing saved yet</h3>
          <p>Tap the heart on any product to keep it here.</p>
          <Link href="/shop">Browse products</Link>
        </div>
      ) : (
        <div
          className="product-grid catalog-grid"
          style={{ marginTop: "2rem" }}
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryName={
                state.categories.find(
                  (category) => category.slug === product.categorySlug,
                )?.name
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
