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
  { href: "/vendor/login", label: "Vendor login" },
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms of use" },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  const items = links.map((link) => (
    <Link key={link.href} href={link.href}>
      {link.label}
    </Link>
  ));
  return (
    <>
      <nav className="footer-links footer-links-desktop" aria-label={title}>
        <h3>{title}</h3>
        <div>{items}</div>
      </nav>
      <details className="footer-links footer-links-mobile">
        <summary>
          {title} <span aria-hidden="true">+</span>
        </summary>
        <div>{items}</div>
      </details>
    </>
  );
}

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
          <div className="footer-brand-lockup">
            <img
              src="/paydan-logo.png"
              alt={state.settings.storeName}
              width={300}
              height={322}
            />
            <p>One storefront. A whole network behind it.</p>
          </div>
          <div className="footer-contact">
            <Link className="footer-contact-heading" href="/contact">
              <span>Talk to us</span>
              <span aria-hidden="true">→</span>
            </Link>
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
            <p className="footer-hours">{state.settings.businessHours}</p>
          </div>
        </div>

        <FooterColumn
          title="Departments"
          links={departments.map((department) => ({
            href: `/category/${department.slug}`,
            label: department.name,
          }))}
        />
        <FooterColumn title="Customer care" links={careLinks} />
        <FooterColumn title={state.settings.storeName} links={companyLinks} />
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
