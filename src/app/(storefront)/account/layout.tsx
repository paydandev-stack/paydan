"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useDemo } from "@/lib/store";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/sourcing-requests", label: "Sourcing requests" },
  { href: "/account/returns", label: "Returns" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { state, actions } = useDemo();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const session = state.customerSession;
  useEffect(() => setNavOpen(false), [pathname]);
  const activeLabel = nav.find((item) => pathname === item.href)?.label ?? "Account";

  return (
    <div className="wrap account-wrap">
      <div className="account-shell">
        <button type="button" className="account-nav-trigger" onClick={() => setNavOpen(true)} aria-expanded={navOpen}>
          <span><small>Your account</small><strong>{activeLabel}</strong></span><b aria-hidden="true">⌄</b>
        </button>
        <aside className={navOpen ? "open" : undefined}>
          <div className="account-nav-head"><strong>Account menu</strong><button type="button" onClick={() => setNavOpen(false)} aria-label="Close account menu">×</button></div>
          <strong>{session ? session.name : "Guest"}</strong>

          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "active" : undefined}
            >
              {item.label}
            </Link>
          ))}

          {session ? (
            <button type="button" onClick={actions.signOutCustomer}>
              Sign out
            </button>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </aside>
        {navOpen ? <button type="button" className="sheet-backdrop" aria-label="Close account menu" onClick={() => setNavOpen(false)} /> : null}

        <section>
          {session ? (
            children
          ) : (
            <div className="account-gate">
              <h1>Your account</h1>
              <p>
                Sign in to view your orders, saved products and account details.
              </p>
              <Link
                className="primary"
                href={`/login?next=${encodeURIComponent(pathname)}`}
              >
                Sign in
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
