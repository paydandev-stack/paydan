import type { Metadata } from "next";
import localFont from "next/font/local";
import { cache } from "react";
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

export const revalidate = 300;

const loadPublicCatalog = cache(publicCatalogSnapshot);

const indexingEnabled = process.env.SITE_INDEXING_ENABLED === "true";

export async function generateMetadata(): Promise<Metadata> {
  const state = await loadPublicCatalog();
  const storeName = state.settings.storeName || "Paydan";
  return {
    title: {
      default: `${storeName} — one storefront, a whole network behind it`,
      template: `%s · ${storeName}`,
    },
    description: `${storeName} lists products from many Nigerian suppliers under one trusted storefront, then coordinates the sourcing and delivery of every order itself.`,
    applicationName: storeName,
    icons: { icon: "/favicon.svg" },
    robots: { index: indexingEnabled, follow: indexingEnabled },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialState = await loadPublicCatalog();
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
