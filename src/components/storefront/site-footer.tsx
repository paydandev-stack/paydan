"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";

const careLinks = [
  { href: "/track-order", label: "Track an order" },
  { href: "/help", label: "Help centre" },
  { href: "/faq", label: "FAQ" },
  { href: "/policies/shipping", label: "Shipping policy" },
  { href: "/policies/returns", label: "Returns policy" },
  { href: "/contact", label: "Contact us" },
];

const companyLinks = [
  { href: "/about", label: "About Paydan" },
  { href: "/request-product", label: "Request a product" },
  { href: "/categories", label: "All departments" },
  { href: "/account", label: "Your account" },
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms of use" },
];

export function SiteFooter() {
  const { state } = useDemo();

  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order)
    .slice(0, 8);

  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <img
            src="/paydan-logo.png"
            alt="Paydan"
            width={3000}
            height={3223}
          />
          <p>One storefront. A whole network behind it.</p>
          <h3>Talk to us</h3>
          {state.settings.supportEmail && (
            <a href={`mailto:${state.settings.supportEmail}`}>
              {state.settings.supportEmail}
            </a>
          )}
          {state.settings.supportPhone && (
            <a href={`tel:${state.settings.supportPhone.replaceAll(" ", "")}`}>
              {state.settings.supportPhone}
            </a>
          )}
          <a href="/contact">{state.settings.businessHours}</a>
        </div>

        <div>
          <h3>Departments</h3>
          {departments.map((department) => (
            <Link key={department.slug} href={`/category/${department.slug}`}>
              {department.name}
            </Link>
          ))}
        </div>

        <div>
          <h3>Customer care</h3>
          {careLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <div>
          <h3>Paydan</h3>
          {companyLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="wrap footer-bottom">
        <span>
          © 2026 Paydan. Thoughtfully sourced, personally coordinated.
        </span>
        <span>Secure payments through Paystack.</span>
      </div>
    </footer>
  );
}
