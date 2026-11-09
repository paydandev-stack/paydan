"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";
import { usePathname } from "next/navigation";
import { CartIcon, GridIcon, HomeIcon, SparkleIcon, UserIcon } from "@/components/icons";

const guestTabs = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/categories", label: "Departments", icon: GridIcon },
  { href: "/cart", label: "Cart", icon: CartIcon },
  { href: "/login", label: "Account", icon: UserIcon },
];

/** Fixed bottom navigation shown below 600px (see responsive.css). */
export function MobileTabBar() {
  const pathname = usePathname();
  const { state } = useDemo();
  const tabs = state.customerSession
    ? [
        { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
        { href: "/categories", label: "Departments", icon: GridIcon },
        { href: "/cart", label: "Cart", icon: CartIcon },
        { href: "/account/profile", label: "Account", icon: UserIcon },
      ]
    : guestTabs;

  return (
    <nav className="mobile-bottom" aria-label="Mobile navigation">
      {tabs.slice(0, 2).map((tab) => {
        const Icon = tab.icon;
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={active ? "active" : undefined}
          >
            <Icon />
            {tab.label}
          </Link>
        );
      })}
      <button
        type="button"
        className="mobile-ask"
        onClick={() => window.dispatchEvent(new Event("paydan:open-assistant"))}
        aria-label="Open Ask PAYDAN"
      >
        <span><SparkleIcon /></span>
        Ask
      </button>
      {tabs.slice(2).map((tab) => {
        const Icon = tab.icon;
        const active = pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined}>
            <Icon />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
