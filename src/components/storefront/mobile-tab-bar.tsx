"use client";

import Link from "next/link";
import { useDemo } from "@/lib/store";
import { usePathname } from "next/navigation";
import { CartIcon, GridIcon, HeartIcon, HomeIcon } from "@/components/icons";

const guestTabs = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/categories", label: "Departments", icon: GridIcon },

  { href: "/cart", label: "Cart", icon: CartIcon },
  { href: "/account/orders", label: "Orders", icon: HeartIcon },
  { href: "/login", label: "Account", icon: HomeIcon },
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
        { href: "/account/orders", label: "Orders", icon: HeartIcon },
        { href: "/account/profile", label: "Account", icon: HomeIcon },
      ]
    : guestTabs;

  return (
    <nav className="mobile-bottom" aria-label="Mobile navigation">
      {tabs.map((tab) => {
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
    </nav>
  );
}
