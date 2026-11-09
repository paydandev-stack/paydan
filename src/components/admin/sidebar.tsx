"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { canAccessAdmin } from "@/lib/admin-access";
import { useDemo } from "@/lib/store";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

/** Single navigation model for the sidebar and the phone-width strip. */
export const adminNav: NavGroup[] = [
  {
    label: "Operation",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/returns", label: "Returns & refunds" },
      { href: "/admin/support", label: "Support inbox" },
      { href: "/admin/procurement", label: "Procurement" },
      { href: "/admin/sourcing-requests", label: "Sourcing queue" },
      { href: "/admin/customers", label: "Customers" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/inventory", label: "Inventory" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/vendors", label: "Vendors" },
      { href: "/admin/promotions", label: "Promotions" },
      { href: "/admin/promotions/banners", label: "Banners" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

const flatNav = adminNav.flatMap((group) => group.items);

/**
 * The most specific nav entry that covers the current path, so
 * `/admin/promotions/banners` highlights Banners rather than Promotions.
 */
function activeHref(pathname: string): string {
  const matches = flatNav.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return "";
  return matches.reduce((best, item) =>
    item.href.length > best.href.length ? item : best,
  ).href;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AdminSidebar() {
  const { state, actions } = useDemo();
  const pathname = usePathname();
  const session = state.adminSession;
  const active = activeHref(pathname);

  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/" aria-label="Paydan storefront">
        <Image
          src="/paydan-logo.png"
          alt="Paydan"
          width={80}
          height={86}
          priority
        />
      </Link>

      {session
        ? adminNav.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <small>{group.label}</small>
              {group.items
                .filter((item) => canAccessAdmin(session.role, item.href))
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active === item.href ? "active" : undefined}
                    aria-current={active === item.href ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
            </div>
          ))
        : null}

      <footer className="admin-session-footer">
        <div className="admin-session-summary">
          <span className="admin-session-avatar" aria-hidden="true">
            {session ? initials(session.name) : "!"}
          </span>
          <span>
            <strong>{session ? session.name : "Admin access required"}</strong>
            <small>
              {session
                ? session.role
                : "Sign in with an authorised operations account"}
            </small>
          </span>
        </div>
        <div className="admin-session-actions">
          <Link href="/">View storefront</Link>
          {session ? (
            <button type="button" onClick={actions.signOutAdmin}>
              Sign out
            </button>
          ) : (
            <Link className="primary" href="/admin/login">
              Sign in
            </Link>
          )}
        </div>
      </footer>
    </aside>
  );
}

/** Replaces the sidebar below 600px, where admin.css hides it. */
export function AdminMobileNav() {
  const { state, actions } = useDemo();
  const pathname = usePathname();
  const session = state.adminSession;
  const active = activeHref(pathname);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
    <button type="button" className="admin-mobile-trigger" onClick={() => setOpen(true)} aria-expanded={open}>
      <span><small>PAYDAN operations</small><strong>{flatNav.find((item) => item.href === active)?.label || "Menu"}</strong></span><b aria-hidden="true">☰</b>
    </button>
    <nav className={`admin-mobile-nav${open ? " open" : ""}`} aria-label="Admin sections">
      <header><strong>Operations menu</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close operations menu">×</button></header>
      {flatNav
        .filter((item) => session && canAccessAdmin(session.role, item.href))
        .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={active === item.href ? "active" : undefined}
            aria-current={active === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      {session ? (
        <button
          type="button"
          onClick={() => {
            actions.signOutAdmin();
          }}
        >
          Sign out
        </button>
      ) : (
        <Link href="/admin/login">Sign in</Link>
      )}
    </nav>
    {open ? <button type="button" className="admin-mobile-backdrop" onClick={() => setOpen(false)} aria-label="Close operations menu" /> : null}
    </>
  );
}
