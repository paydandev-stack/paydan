"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import {
  CartIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GridIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";

/** A representative city per delivery state, used by the location picker. */
const CITY_BY_STATE: Record<string, string> = {
  Lagos: "Ikeja",
  FCT: "Abuja",
  Rivers: "Port Harcourt",
  Kano: "Kano",
  Oyo: "Ibadan",
  Enugu: "Enugu",
};

export function SiteHeader() {
  const { state, actions } = useDemo();
  const router = useRouter();
  const pathname = usePathname();

  const [navOpen, setNavOpen] = useState(false);
  const [departmentsOpen, setDepartmentsOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order);

  const cartCount = state.cart.reduce(
    (total, line) => total + line.quantity,
    0,
  );

  function closeAll() {
    setNavOpen(false);
    setDepartmentsOpen(false);
    setLocationOpen(false);
  }

  // Jumping between pages should never leave a panel hanging open.
  useEffect(() => {
    closeAll();
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!navRef.current?.contains(target)) {
        setNavOpen(false);
        setDepartmentsOpen(false);
      }
      if (!locationRef.current?.contains(target)) setLocationOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAll();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(
      new FormData(event.currentTarget).get("q") ?? "",
    ).trim();
    closeAll();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  const accountHref = state.customerSession ? "/dashboard" : "/login";
  const accountLabel = state.customerSession ? "My dashboard" : "Sign in";

  return (
    <>
      <div className="utility">
        <div className="wrap utility-inner">
          <span>{state.settings.announcement}</span>
          <div className="utility-links">
            <Link href="/track-order">Track order</Link>
            <Link href="/request-product">Request a product</Link>
            <Link href="/help">Help</Link>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap header-main">
          <button
            type="button"
            className="mobile-menu"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
            aria-controls="primary-navigation"
            onClick={() => setNavOpen((open) => !open)}
          >
            <MenuIcon />
          </button>

          <Link className="brand" href="/" aria-label="Paydan home">
            <img
              src="/paydan-logo.png"
              alt="Paydan"
              width={3000}
              height={3223}
            />
          </Link>

          <div className="location-wrap" ref={locationRef}>
            <button
              type="button"
              className="location"
              aria-haspopup="true"
              aria-expanded={locationOpen}
              onClick={() => setLocationOpen((open) => !open)}
            >
              <span>Deliver to</span>
              <strong>
                {[state.location.city, state.location.state]
                  .filter(Boolean)
                  .join(", ")}
              </strong>
            </button>

            {locationOpen ? (
              <div
                className="location-pop"
                role="group"
                aria-label="Delivery location"
              >
                <strong>Choose your state</strong>
                {state.shippingZones
                  .filter((zone) => zone.active)
                  .map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => {
                        actions.setLocation({
                          state: zone.state,
                          city: CITY_BY_STATE[zone.state] ?? zone.state,
                        });
                        setLocationOpen(false);
                      }}
                    >
                      <span>{zone.state}</span>
                      <small>{zone.eta}</small>
                    </button>
                  ))}
                <p className="location-note">
                  Delivery fees are estimated at checkout and confirmed per
                  supplier.
                </p>
              </div>
            ) : null}
          </div>

          <form className="search" role="search" onSubmit={handleSearch}>
            <SearchIcon />
            <input
              type="search"
              name="q"
              placeholder="Search products, brands and departments"
              aria-label="Search products"
              enterKeyHint="search"
            />
            <button type="submit">Search</button>
          </form>

          <nav className="actions" aria-label="Quick links">
            <Link href="/account/wishlist">
              <HeartIcon />
              <span>Wishlist</span>
            </Link>
            <Link href={accountHref}>
              <UserIcon />
              <span>{accountLabel}</span>
            </Link>
            <Link className="cart-link" href="/cart">
              <CartIcon />
              <span>Cart</span>
              {cartCount > 0 ? (
                <b aria-label={`${cartCount} items in cart`}>{cartCount}</b>
              ) : null}
            </Link>
          </nav>
        </div>

        <div
          className={`category-nav${navOpen ? " open" : ""}`}
          id="primary-navigation"
          ref={navRef}
        >
          <div className="wrap nav-inner">
            <div className="mobile-drawer-head">
              <strong>Browse PAYDAN</strong>
              <button type="button" onClick={closeAll} aria-label="Close menu">×</button>
            </div>
            <button
              type="button"
              className="departments"
              aria-expanded={departmentsOpen}
              aria-controls="department-mega-menu"
              onClick={() => setDepartmentsOpen((open) => !open)}
            >
              <GridIcon />
              Departments
              <ChevronDownIcon />
            </button>

            <Link href="/shop">Shop all</Link>
            <Link href="/deals">Deals</Link>
            <Link href="/new-arrivals">New arrivals</Link>
            <Link href="/request-product">Request a product</Link>
            <Link href="/help">Help</Link>

            <div className="nav-departments">
              {departments.map((department) => (
                <Link
                  key={department.slug}
                  href={`/category/${department.slug}`}
                >
                  {department.name}
                </Link>
              ))}
            </div>
          </div>

          {departmentsOpen ? (
            <div className="mega-menu" id="department-mega-menu">
              <div className="mega-list">
                {departments.map((department) => (
                  <Link
                    key={department.slug}
                    href={`/category/${department.slug}`}
                  >
                    {department.name}
                    <ChevronRightIcon />
                  </Link>
                ))}
              </div>

              <div className="mega-column">
                <span>Shop</span>
                <Link href="/shop">All products</Link>
                <Link href="/deals">Deals</Link>
                <Link href="/new-arrivals">New arrivals</Link>
                <Link href="/categories">All departments</Link>
              </div>

              <div className="mega-column">
                <span>Service</span>
                <Link href="/help">Help centre</Link>
                <Link href="/faq">FAQ</Link>
                <Link href="/policies/shipping">Shipping</Link>
                <Link href="/policies/returns">Returns</Link>
              </div>

              <div className="mega-feature">
                <small>Paydan sourcing</small>
                <strong>
                  Can&rsquo;t find it? We&rsquo;ll source it for you.
                </strong>
                <Link href="/request-product">Make a request</Link>
              </div>
            </div>
          ) : null}
        </div>
      </header>
      {navOpen ? <button type="button" className="site-nav-backdrop" onClick={closeAll} aria-label="Close menu" /> : null}
    </>
  );
}
