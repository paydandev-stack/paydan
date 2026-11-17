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
  it("uses a compound Gateway candidate followed by independent Groq", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER_PROFILE", "production");
    vi.stubEnv("GROQ_API_KEY", "test-value-only");
    const models = assistantModels();

    expect(models.map(({ name }) => name)).toEqual([
      "vercel-gateway",
      "groq-direct",
    ]);
    expect(models[0]?.modelId).toBe("reflection/beam-free");
    expect(models[0]?.providerOptions).toEqual({
      gateway: {
        models: ["humansand/ampersand-v0.1"],
        has: ["tool-use"],
      },
    });
    expect(models[1]?.modelId).toBe("openai/gpt-oss-20b");
  });

  it("does not require Groq to run the compound Gateway request", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER_PROFILE", "production");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(assistantModels().map(({ name }) => name)).toEqual([
      "vercel-gateway",
    ]);
  });

  it("uses the approved free model defaults and bounded timeout", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER_PROFILE", "production");
    expect(assistantConfig()).toMatchObject({
      primaryModel: "reflection/beam-free",
      secondaryModel: "humansand/ampersand-v0.1",
      groqModel: "openai/gpt-oss-20b",
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
    vi.stubEnv("AI_PRIMARY_MODEL", "not-a-provider-model");
    expect(() => assistantConfig()).toThrow();
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
    candidates: second ? ["gateway", "groq"] : ["gateway"],
    abortSignal,
    attempt(candidate) {
      calls.push(candidate);
      return {
        stream: parts(...(candidate === "gateway" ? first : second || [])),
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
      candidate: "gateway",
      attempts: 1,
    });
    expect(calls).toEqual(["gateway"]);
  });

  it.each([
    ["server error", providerError(500)],
    ["rate limit", providerError(429)],
    ["timeout", providerError(undefined, "request timed out")],
    ["network", providerError(undefined, "fetch failed")],
  ])("falls back to Groq for a pre-output %s", async (_label, error) => {
    const { result, calls } = runRoute({
      first: [error],
      second: [{ type: "text-delta", value: "backup" }],
    });
    await expect(result).resolves.toMatchObject({
      status: "success",
      candidate: "groq",
      attempts: 2,
    });
    expect(calls).toEqual(["gateway", "groq"]);
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
        candidate: "gateway",
        attempts: 1,
      });
      expect(calls).toEqual(["gateway"]);
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
        candidate: "gateway",
        attempts: 1,
      });
      expect(calls).toEqual(["gateway"]);
    },
  );

  it("returns exhausted when Groq also fails transiently", async () => {
    const { result, calls } = runRoute({
      first: [providerError(503)],
      second: [providerError(429)],
    });
    await expect(result).resolves.toMatchObject({
      status: "exhausted",
      candidate: "groq",
      attempts: 2,
    });
    expect(calls).toEqual(["gateway", "groq"]);
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
      candidate: "gateway",
      attempts: 1,
    });
    expect(calls).toEqual(["gateway"]);
  });

  it("classifies only the approved provider failures as transient", () => {
    expect(classifyAIError(providerError(408)).transient).toBe(true);
    expect(classifyAIError(providerError(429)).transient).toBe(true);
    expect(classifyAIError(providerError(503)).transient).toBe(true);
    expect(classifyAIError(providerError(401)).transient).toBe(false);
  });
});
