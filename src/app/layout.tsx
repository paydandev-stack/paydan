import type { Metadata } from "next";
import localFont from "next/font/local";
import { DemoProvider } from "@/lib/store";
import { ToastViewport } from "@/components/toast-viewport";
import { SubtleMotion } from "@/components/subtle-motion";
import { AskPaydan } from "@/components/assistant/ask-paydan";
import "./globals.css";
import { publicCatalogSnapshot } from "@/server/public-catalog";

const manrope = localFont({
  src: "./fonts/manrope-latin.woff2",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
  adjustFontFallback: "Arial",
});

const newsreader = localFont({
  src: "./fonts/newsreader-latin.woff2",
  weight: "400 600",
  variable: "--font-newsreader",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Paydan — one storefront, a whole network behind it",
    template: "%s · Paydan",
  },
  description:
    "Paydan lists products from many Nigerian suppliers under one trusted storefront, then coordinates the sourcing and delivery of every order itself.",
  applicationName: "Paydan",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialState = await publicCatalogSnapshot();
  return (
    <html lang="en-NG" className={`${manrope.variable} ${newsreader.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <DemoProvider initialState={initialState}>
          {children}
          <ToastViewport />
          <AskPaydan />
          <SubtleMotion />
        </DemoProvider>
      </body>
    </html>
  );
}
