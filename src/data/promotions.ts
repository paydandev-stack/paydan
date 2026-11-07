import "server-only";
import type { Banner } from "@/lib/types";
import { IMAGES } from "./images";

export const seedBanners: Banner[] = [
  {
    id: "b-1",
    title: "Everything you need, sourced with care.",
    eyebrow: "The Paydan edit",
    subtitle:
      "Shop everyday essentials, standout technology and fresh finds — all through one trusted storefront.",
    ctaLabel: "Explore the collection",
    href: "/shop",
    image: IMAGES.shopping,
    placement: "hero",
    active: true,
    startAt: "2026-10-01T00:00:00Z",
    endAt: "2026-12-31T23:59:00Z",
  },
  {
    id: "b-2",
    title: "Upgrade your everyday tech.",
    eyebrow: "Technology & gadgets",
    subtitle: "Phones, laptops and audio selected for how you live and work.",
    ctaLabel: "Shop technology",
    href: "/category/phones-and-tablets",
    image: IMAGES.laptop,
    placement: "hero",
    active: true,
    startAt: "2026-10-15T00:00:00Z",
    endAt: "2026-11-30T23:59:00Z",
  },
  {
    id: "b-3",
    title: "Fresh finds for your home.",
    eyebrow: "Home & living",
    subtitle: "Furniture, bedding and tableware for calmer, better-run homes.",
    ctaLabel: "Shop the home edit",
    href: "/category/home-and-living",
    image: IMAGES.interior,
    placement: "hero",
    active: true,
    startAt: "2026-10-20T00:00:00Z",
    endAt: "2026-12-15T23:59:00Z",
  },
  {
    id: "b-4",
    title: "Better tools for everyday life.",
    eyebrow: "Tech refresh",
    subtitle: "",
    ctaLabel: "Shop technology",
    href: "/category/phones-and-tablets",
    image: IMAGES.workspace,
    placement: "side",
    active: true,
    startAt: "2026-10-01T00:00:00Z",
    endAt: "2026-12-31T23:59:00Z",
  },
  {
    id: "b-5",
    title: "Can't find it? We'll help source it.",
    eyebrow: "Paydan sourcing",
    subtitle: "",
    ctaLabel: "Make a request",
    href: "/request-product",
    image: IMAGES.workspace,
    placement: "side",
    active: true,
    startAt: "2026-10-01T00:00:00Z",
    endAt: "2027-01-31T23:59:00Z",
  },
];

export const sampleVouchers = [
  {
    code: "SAMPLE5000",
    type: "fixed" as const,
    value: 5000,
    minimum: 40000,
    description: "₦5,000 off orders over ₦40,000",
  },
  {
    code: "PAYDAN10",
    type: "percent" as const,
    value: 10,
    minimum: 100000,
    description: "10% off orders over ₦100,000",
  },
];
