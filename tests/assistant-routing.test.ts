import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../src/lib/types";
import {
  normalizeProductQuery,
  searchRelevantProducts,
} from "../src/lib/assistant";
import {
  assistantConfig,
  classifyAIError,
} from "../src/server/assistant/config";
import { assistantModels } from "../src/server/assistant/providers";
import { routeProviderStreams } from "../src/server/assistant/routing";
import { products as seededProducts } from "../src/data/products";
import { categories as seededCategories } from "../src/data/categories";

function product(
  id: string,
  name: string,
  description: string,
  categorySlug: string,
): Product {
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
  product(
    "skin",
    "Daily Radiance Skincare Set",
    "Facial moisturiser",
    "health-and-beauty",
  ),
  product("bag", "Classic Leather Carryall", "Handbag", "shoes-and-bags"),
  product(
    "shoes",
    "Everyday Canvas Sneakers",
    "Lightweight sneakers",
    "shoes-and-bags",
  ),
  product(
    "car-care",
    "Car Care Detail",
    "Cleaning products",
    "automotive-and-fuel",
  ),
  product(
    "vehicle",
    "Toyota Corolla",
    "A used Toyota sedan vehicle",
    "automotive-and-fuel",
  ),
  product("phone", "iPhone 15", "Apple smartphone", "phones-and-tablets"),
  product(
    "headphone",
    "Bluetooth Headphones",
    "Compatible with phones",
    "phones-and-tablets",
  ),
  product(
    "case",
    "Phone Case",
    "Protective cover for phones",
    "phones-and-tablets",
  ),
];

function ids(query: string): string[] {
  return searchRelevantProducts(query, catalog, 10).map((item) => item.id);
}

describe("Ask PAYDAN catalogue relevance", () => {
  it("covers every visible department with at least one published demo product", () => {
    const visible = seededCategories.filter(
      (category) => category.active && !category.restricted,
    );
    for (const category of visible)
      expect(
        seededProducts.some(
          (item) =>
            item.categorySlug === category.slug &&
            item.status === "published" &&
            !item.restricted,
        ),
        `missing demo coverage for ${category.slug}`,
      ).toBe(true);
  });

  it("finds seeded footwear in the real demo catalogue", () => {
    expect(
      searchRelevantProducts("show me shoes", seededProducts, 10).some(
        (item) => item.categorySlug === "shoes-and-bags",
      ),
    ).toBe(true);
  });
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
  it("uses direct Groq followed by independent OpenRouter", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER_PROFILE", "production");
    vi.stubEnv("GROQ_API_KEY", "test-value-only");
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-value-only");
    const models = assistantModels();

    expect(models.map(({ name }) => name)).toEqual([
      "groq-direct",
      "openrouter-free",
    ]);
    expect(models[0]?.modelId).toBe("openai/gpt-oss-20b");
    expect(models[1]?.modelId).toBe("openrouter/free");
  });

  it("can run OpenRouter when Groq is not configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER_PROFILE", "production");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-value-only");
    expect(assistantModels().map(({ name }) => name)).toEqual([
      "openrouter-free",
    ]);
  });

  it("uses the approved direct-provider defaults and bounded timeout", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER_PROFILE", "production");
    expect(assistantConfig()).toMatchObject({
      groqModel: "openai/gpt-oss-20b",
      openRouterModel: "openrouter/free",
      timeoutMs: 12_000,
    });
  });

  it("rejects legacy Groq variables instead of silently diverging", () => {
    vi.stubEnv("AI_GROQ_API_KEY", "retired-variable");
    expect(() => assistantConfig()).toThrow(/legacy AI variables/i);
  });

  it("rejects invalid timeout and model values", () => {
    vi.stubEnv("AI_PROVIDER_TIMEOUT_MS", "999");
    expect(() => assistantConfig()).toThrow();
    vi.stubEnv("AI_PROVIDER_TIMEOUT_MS", "12000");
    vi.stubEnv("OPENROUTER_MODEL", "not-a-provider-model");
    expect(() => assistantConfig()).toThrow();
  });

  it("rejects retired Gateway variables", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "retired-gateway-key");
    expect(() => assistantConfig()).toThrow(/Gateway has been retired/i);
  });
});

type TestPart = {
  type: "text-delta" | "tool-call" | "tool-result";
  value?: string;
};

function providerError(statusCode?: number, message = "provider failed") {
  return Object.assign(new Error(message), { statusCode });
}

async function* parts(...items: Array<TestPart | Error>) {
  for (const item of items) {
    if (item instanceof Error) throw item;
    yield item;
  }
}

function runRoute({
  first,
  second,
  abortSignal,
}: {
  first: Array<TestPart | Error>;
  second?: Array<TestPart | Error>;
  abortSignal?: AbortSignal;
}) {
  const calls: string[] = [];
  const result = routeProviderStreams({
    candidates: second ? ["groq", "openrouter"] : ["groq"],
    abortSignal,
    attempt(candidate) {
      calls.push(candidate);
      return {
        stream: parts(...(candidate === "groq" ? first : second || [])),
      };
    },
    isMeaningful: (part) =>
      part.type === "tool-call" ||
      part.type === "tool-result" ||
      (part.type === "text-delta" && Boolean(part.value)),
    onPart: () => undefined,
  });
  return { result, calls };
}

describe("AI failover stream safety", () => {
  it("reports an unconfigured route when no provider is available", async () => {
    const outcome = await routeProviderStreams({
      candidates: [] as string[],
      attempt: () => ({ stream: parts() }),
      isMeaningful: () => false,
      onPart: () => undefined,
    });
    expect(outcome).toEqual({ status: "unconfigured", attempts: 0 });
  });

  it("returns the primary result without calling Groq", async () => {
    const { result, calls } = runRoute({
      first: [{ type: "text-delta", value: "hello" }],
      second: [{ type: "text-delta", value: "backup" }],
    });
    await expect(result).resolves.toMatchObject({
      status: "success",
      candidate: "groq",
      attempts: 1,
    });
    expect(calls).toEqual(["groq"]);
  });

  it.each([
    ["server error", providerError(500)],
    ["rate limit", providerError(429)],
    ["timeout", providerError(undefined, "request timed out")],
    ["network", providerError(undefined, "fetch failed")],
  ])("falls back to OpenRouter for a pre-output %s", async (_label, error) => {
    const { result, calls } = runRoute({
      first: [error],
      second: [{ type: "text-delta", value: "backup" }],
    });
    await expect(result).resolves.toMatchObject({
      status: "success",
      candidate: "openrouter",
      attempts: 2,
    });
    expect(calls).toEqual(["groq", "openrouter"]);
  });

  it.each([400, 401, 403, 404, 409, 422])(
    "does not fall back for terminal status %i",
    async (statusCode) => {
      const { result, calls } = runRoute({
        first: [providerError(statusCode)],
        second: [{ type: "text-delta", value: "must not run" }],
      });
      await expect(result).resolves.toMatchObject({
        status: "terminal",
        candidate: "groq",
        attempts: 1,
      });
      expect(calls).toEqual(["groq"]);
    },
  );

  it.each(["text-delta", "tool-call", "tool-result"] as const)(
    "never replays after a %s event",
    async (type) => {
      const meaningful: TestPart =
        type === "text-delta" ? { type, value: "started" } : { type };
      const { result, calls } = runRoute({
        first: [meaningful, providerError(500)],
        second: [{ type: "text-delta", value: "must not run" }],
      });
      await expect(result).resolves.toMatchObject({
        status: "partial",
        candidate: "groq",
        attempts: 1,
      });
      expect(calls).toEqual(["groq"]);
    },
  );

  it("returns exhausted when OpenRouter also fails transiently", async () => {
    const { result, calls } = runRoute({
      first: [providerError(503)],
      second: [providerError(429)],
    });
    await expect(result).resolves.toMatchObject({
      status: "exhausted",
      candidate: "openrouter",
      attempts: 2,
    });
    expect(calls).toEqual(["groq", "openrouter"]);
  });

  it("stops on browser cancellation without trying another provider", async () => {
    const controller = new AbortController();
    controller.abort();
    const { result, calls } = runRoute({
      first: [providerError(undefined, "request aborted")],
      second: [{ type: "text-delta", value: "must not run" }],
      abortSignal: controller.signal,
    });
    await expect(result).resolves.toMatchObject({
      status: "aborted",
      candidate: "groq",
      attempts: 1,
    });
    expect(calls).toEqual(["groq"]);
  });

  it("classifies only the approved provider failures as transient", () => {
    expect(classifyAIError(providerError(408)).transient).toBe(true);
    expect(classifyAIError(providerError(429)).transient).toBe(true);
    expect(classifyAIError(providerError(503)).transient).toBe(true);
    expect(classifyAIError(providerError(401)).transient).toBe(false);
  });
});
