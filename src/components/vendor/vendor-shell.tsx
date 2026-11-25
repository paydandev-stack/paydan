"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";

type Props = {
  active: "overview" | "products" | "orders";
  vendorName: string;
  email: string;
  children: React.ReactNode;
};

const links = [
  { href: "/vendor", key: "overview", label: "Overview", icon: "◇" },
  {
    href: "/vendor/products",
    key: "products",
    label: "My catalogue",
    icon: "▦",
  },
  { href: "/vendor/orders", key: "orders", label: "Order queue", icon: "≡" },
] as const;

export function VendorShell({ active, vendorName, email, children }: Props) {
  const { actions } = useDemo();
  return (
    <div className="vendor-app">
      <aside className="vendor-sidebar">
        <Link href="/" className="vendor-brand">
          <img src="/paydan-logo.png" alt="Paydan" width={80} height={86} />
          <span>
            <strong>PAYDAN</strong>
            <small>Supplier workspace</small>
          </span>
        </Link>

        <nav className="vendor-nav" aria-label="Vendor portal">
          <small>WORKSPACE</small>
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={active === link.key ? "active" : undefined}
              aria-current={active === link.key ? "page" : undefined}
            >
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="vendor-sidebar-foot">
          <div className="vendor-account">
            <span aria-hidden="true">
              {vendorName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{vendorName}</strong>
              <small title={email}>{email}</small>
            </div>
          </div>
          <Link href="/">Back to storefront</Link>
          <button type="button" onClick={() => actions.signOutAdmin()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="vendor-content">
        <header className="vendor-mobile-bar">
          <Link href="/" className="vendor-mobile-brand">
            <img src="/paydan-logo.png" alt="Paydan" width={34} height={36} />
            <strong>PAYDAN</strong>
          </Link>
          <div className="vendor-mobile-links">
            {links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className={active === link.key ? "active" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
