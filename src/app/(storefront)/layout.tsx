import type { ReactNode } from "react";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { MobileTabBar } from "@/components/storefront/mobile-tab-bar";

/** Public shopping shell: utility bar, header, footer and mobile tab bar. */
export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
      <MobileTabBar />
    </>
  );
}
