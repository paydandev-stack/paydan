"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { useDemo } from "@/lib/store";
import { toMemberProducts } from "@/lib/catalog-dto";
import { readIntent, clearIntent, type ShoppingIntent } from "@/lib/intent";
import { api } from "@/lib/api-client";
export default function Dashboard() {
  const { state, hydrated, refresh, actions } = useDemo();
  const [intent, setIntent] = useState<ShoppingIntent | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null,
  );
  const [departmentMenuOpen, setDepartmentMenuOpen] = useState(false);
  const productFeedRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setIntent(readIntent());
  }, []);
  if (!hydrated)
    return (
      <div className="wrap dashboard" aria-busy="true">
        Opening your dashboard…
      </div>
    );
  if (!state.customerSession)
    return (
      <div className="wrap dashboard">
        <h1>Your personal shopping space</h1>
        <p>Sign in to see member prices, your orders and saved finds.</p>
        <Link className="primary" href="/login">
          Sign in
        </Link>
      </div>
    );
  const products = toMemberProducts(
    state.products.filter((p) => p.status === "published" && !p.restricted),
  );
  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order);
  const activeDepartment = departments.find(
    (department) => department.slug === selectedDepartment,
  );
  const displayedProducts = activeDepartment
    ? products.filter(
        (product) => product.categorySlug === activeDepartment.slug,
      )
    : products.slice(0, 12);
  function chooseDepartment(slug: string | null) {
    setSelectedDepartment(slug);
    setDepartmentMenuOpen(false);
    window.requestAnimationFrame(() => {
      const feed = productFeedRef.current;
      if (!feed) return;
      const bounds = feed.getBoundingClientRect();
      const feedIsOutOfView =
        bounds.top < 0 || bounds.top > window.innerHeight * 0.45;
      if (feedIsOutOfView)
        feed.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
    });
  }
  async function resume() {
    if (!intent || busy) return;
    setBusy(true);
    try {
      if (intent.productId && intent.variantId)
        await api("/api/commands", {
          name: "mergeIntent",
          args: [
            {
              productId: intent.productId,
              variantId: intent.variantId,
              quantity: intent.quantity ?? 1,
            },
          ],
          key: intent.id,
        });
      await refresh();
      clearIntent();
      location.assign(intent.productId ? "/cart" : intent.path);
    } catch (error) {
      actions.notify(
        error instanceof Error ? error.message : "Please try again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap dashboard">
      <header className="dashboard-welcome">
        <div>
          <span className="kicker green">YOUR PAYDAN</span>
          <h1>Hello, {state.customerSession.name.split(" ")[0]}.</h1>
          <p>
            {state.addresses[0]
              ? `Shopping for ${state.addresses[0].city}, ${state.addresses[0].state}`
              : "A little inspiration for your everyday."}
          </p>
        </div>
        <Link href="/account/profile">Manage your account →</Link>
      </header>
      {intent && (
        <section className="resume-card">
          <div>
            <strong>Pick up where you left off</strong>
            <p>
              {intent.productId
                ? "Your product selection is ready to add to your cart."
                : "Continue exploring the page you saved before signing in."}
            </p>
          </div>
          <button className="primary" disabled={busy} onClick={resume}>
            {busy ? "Updating…" : "Continue"}
          </button>
          <button
            onClick={() => {
              clearIntent();
              setIntent(null);
            }}
          >
            Dismiss
          </button>
        </section>
      )}
      <nav className="dashboard-shortcuts">
        <Link href="/account/orders">
          <strong>{state.orders.length}</strong> Your orders
        </Link>
        <Link href="/account/wishlist">
          <strong>{state.wishlist.length}</strong> Saved finds
        </Link>
        <Link href="/account/sourcing-requests">
          <strong>{state.sourcing.length}</strong> Sourcing requests
        </Link>
        <Link href="/cart">
          <strong>{state.cart.reduce((n, l) => n + l.quantity, 0)}</strong> In
          your cart
        </Link>
      </nav>
      <section className="dashboard-shop" aria-labelledby="department-heading">
        <div className="dashboard-department-select">
          <span>Find your department</span>
          <button type="button" onClick={() => setDepartmentMenuOpen(true)} aria-expanded={departmentMenuOpen}>
            {activeDepartment?.name ?? "For you"} <b aria-hidden="true">⌄</b>
          </button>
        </div>
        <div className={departmentMenuOpen ? "dashboard-department-sheet open" : "dashboard-department-sheet"} role="dialog" aria-modal="true" aria-label="Choose a department">
          <header><strong>Choose a department</strong><button type="button" onClick={() => setDepartmentMenuOpen(false)} aria-label="Close departments">×</button></header>
          <nav>
            <button type="button" className={!activeDepartment ? "active" : undefined} onClick={() => chooseDepartment(null)}>For you <span>Personal picks</span></button>
            {departments.map((department) => (
              <button type="button" key={department.slug} className={activeDepartment?.slug === department.slug ? "active" : undefined} onClick={() => chooseDepartment(department.slug)}>
                {department.name}
                <span>{products.filter((product) => product.categorySlug === department.slug).length} products</span>
              </button>
            ))}
          </nav>
        </div>
        {departmentMenuOpen ? <button type="button" className="sheet-backdrop" aria-label="Close departments" onClick={() => setDepartmentMenuOpen(false)} /> : null}

        <div className="dashboard-shop-layout">
          <aside className="dashboard-department-sidebar">
            <div className="dashboard-department-intro">
              <span className="kicker green">SHOP BY CATEGORY</span>
              <h2 id="department-heading">Find your department</h2>
              <p>Choose a department to tailor the products beside you.</p>
            </div>
            <nav aria-label="Dashboard departments">
              <button
                type="button"
                className={!activeDepartment ? "active" : undefined}
                aria-pressed={!activeDepartment}
                onClick={() => chooseDepartment(null)}
              >
                <span>
                  <strong>For you</strong>
                  <small>Personal picks</small>
                </span>
                <b aria-hidden="true">→</b>
              </button>
              {departments.map((department) => {
                const active = activeDepartment?.slug === department.slug;
                return (
                  <button
                    type="button"
                    key={department.slug}
                    className={active ? "active" : undefined}
                    aria-pressed={active}
                    onClick={() => chooseDepartment(department.slug)}
                  >
                    <span>
                      <strong>{department.name}</strong>
                      <small>
                        {
                          products.filter(
                            (product) =>
                              product.categorySlug === department.slug,
                          ).length
                        }{" "}
                        products
                      </small>
                    </span>
                    <b aria-hidden="true">→</b>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div
            className="dashboard-product-feed"
            ref={productFeedRef}
            aria-live="polite"
          >
            <div className="section-heading dashboard-feed-heading">
              <div>
                <span className="kicker green">
                  {activeDepartment
                    ? `EXPLORE ${activeDepartment.name}`
                    : "FIND YOUR NEXT FAVOURITE"}
                </span>
                <h2>
                  {activeDepartment?.title ?? "Selected for your everyday"}
                </h2>
                {activeDepartment ? (
                  <p>{activeDepartment.description}</p>
                ) : null}
              </div>
              <Link
                href={
                  activeDepartment
                    ? `/category/${activeDepartment.slug}`
                    : "/shop"
                }
              >
                {activeDepartment
                  ? `View all in ${activeDepartment.name}`
                  : "Browse all products"}{" "}
                →
              </Link>
            </div>

            {displayedProducts.length ? (
              <div className="product-grid dashboard-product-grid">
                {displayedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} showPrice />
                ))}
              </div>
            ) : (
              <div className="dashboard-feed-empty">
                <h3>No products are listed here yet.</h3>
                <p>
                  Browse another department or ask our sourcing team to find
                  what you need.
                </p>
                <Link href="/request-product">Request a product →</Link>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="resume-card">
        <div>
          <h2>Something specific in mind?</h2>
          <p>
            Ask PAYDAN for help exploring, or send our team a sourcing request.
          </p>
        </div>
        <Link href="/request-product">Request a product →</Link>
      </section>
    </div>
  );
}
