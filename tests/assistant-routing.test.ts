import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../src/lib/types";
import { normalizeProductQuery, searchRelevantProducts } from "../src/lib/assistant";
import { assistantConfig } from "../src/server/assistant/config";
import { assistantModels } from "../src/server/assistant/providers";

function product(id: string, name: string, description: string, categorySlug: string): Product {
  return {
    id,
    name,
    description,
    categorySlug,
    brand: "Test",
    highlights: [],
    specifications: {},
  } as unknown as Product;
}

const catalog = [
  product("skin", "Daily Radiance Skincare Set", "Facial moisturiser", "health-and-beauty"),
  product("bag", "Classic Leather Carryall", "Handbag", "shoes-and-bags"),
  product("shoes", "Everyday Canvas Sneakers", "Lightweight sneakers", "shoes-and-bags"),
  product("car-care", "Car Care Detail", "Cleaning products", "automotive-and-fuel"),
  product("vehicle", "Toyota Corolla", "A used Toyota sedan vehicle", "automotive-and-fuel"),
  product("phone", "iPhone 15", "Apple smartphone", "phones-and-tablets"),
  product("headphone", "Bluetooth Headphones", "Compatible with phones", "phones-and-tablets"),
  product("case", "Phone Case", "Protective cover for phones", "phones-and-tablets"),
];

function ids(query: string): string[] {
  return searchRelevantProducts(query, catalog, 10).map((item) => item.id);
}

describe("Ask PAYDAN catalogue relevance", () => {
  it("matches real vehicles, not skincare or car-care accessories", () => {
    expect(ids("what of a car")).toEqual(["vehicle"]);
  });

  it("shows shoes, not bags from the shared shoes-and-bags category", () => {
    expect(ids("what of some shoes")).toEqual(["shoes"]);
  });

  it("shows bags, not shoes from the shared shoes-and-bags category", () => {
    expect(ids("what of some bags")).toEqual(["bag"]);
  });

  it("shows smartphones, not headphones or cases", () => {
    expect(ids("find me phones")).toEqual(["phone"]);
  });

  it("keeps specific searches like car care working", () => {
    expect(ids("car care")).toContain("car-care");
  });

  it("removes conversational filler terms", () => {
    expect(normalizeProductQuery("what of some shoes for me")).toBe("shoe");
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("AI production routing", () => {
  it("keeps production profile while accepting Groq as third model", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER_PROFILE", "production");
    vi.stubEnv("GROQ_API_KEY", "test-value-only");
    expect(assistantConfig().profile).toBe("production");
    expect(assistantModels().map(({ name }) => name)).toEqual([
      "gateway-primary", "gateway-secondary", "groq-fallback",
    ]);
  });

  it("does not require Groq to run the two Gateway models", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER_PROFILE", "production");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(assistantModels().map(({ name }) => name)).toEqual([
      "gateway-primary", "gateway-secondary",
    ]);
  });
});
