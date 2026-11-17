import "server-only";

import { z } from "zod";

const profileSchema = z.enum(["production", "test", "test-last"]);
export type AssistantProfile = z.infer<typeof profileSchema>;

const modelSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i,
    "AI model IDs must use creator/model format.",
  );

const timeoutSchema = z.coerce.number().int().min(1_000).max(60_000);

export function assistantConfig() {
  const legacyGroqVariables = [
    "AI_GROQ_API_KEY",
    "AI_GROQ_MODEL",
    "AI_GROQ_BASE_URL",
    "AI_TEST_GROQ_ENABLED",
    "AI_TEST_GROQ_MODE",
  ].filter((key) => process.env[key]?.trim());
  if (legacyGroqVariables.length)
    throw new Error(
      `Remove legacy AI variables and use GROQ_API_KEY/GROQ_MODEL instead: ${legacyGroqVariables.join(", ")}.`,
    );

  const profile = profileSchema.parse(
    process.env.AI_PROVIDER_PROFILE ||
      (process.env.NODE_ENV === "production" ? "production" : "test"),
  );
  if (process.env.NODE_ENV === "production" && profile !== "production")
    throw new Error("Direct test AI providers are disabled in production.");

  return {
    profile,
    primaryModel: modelSchema.parse(
      process.env.AI_PRIMARY_MODEL || "reflection/beam-free",
    ),
    secondaryModel: modelSchema.parse(
      process.env.AI_SECONDARY_MODEL || "humansand/ampersand-v0.1",
    ),
    groqModel: modelSchema.parse(
      process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    ),
    timeoutMs: timeoutSchema.parse(
      process.env.AI_PROVIDER_TIMEOUT_MS || "12000",
    ),
  };
}

type ErrorDetails = {
  statusCode?: number;
  status?: number;
  name?: string;
  message?: string;
  cause?: unknown;
};

function errorDetails(error: unknown): ErrorDetails[] {
  const details: ErrorDetails[] = [];
  let current = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current !== "object") break;
    const value = current as ErrorDetails;
    details.push(value);
    current = value.cause;
  }
  return details;
}

export type AIErrorClass =
  | "authentication"
  | "authorization"
  | "invalid-request"
  | "not-found"
  | "rate-limit"
  | "timeout"
  | "provider-unavailable"
  | "network"
  | "unknown";

export function classifyAIError(error: unknown): {
  kind: AIErrorClass;
  status?: number;
  transient: boolean;
} {
  const chain = errorDetails(error);
  const status = chain
    .map((value) => value.statusCode ?? value.status)
    .find((value): value is number => typeof value === "number");
  const text = chain
    .map((value) => `${value.name || ""} ${value.message || ""}`)
    .join(" ");

  if (status === 401)
    return { kind: "authentication", status, transient: false };
  if (status === 402 || status === 403)
    return { kind: "authorization", status, transient: false };
  if (status === 400 || status === 409 || status === 422)
    return { kind: "invalid-request", status, transient: false };
  if (status === 404) return { kind: "not-found", status, transient: false };
  if (status === 408 || /timeout|timed out/i.test(text))
    return { kind: "timeout", status, transient: true };
  if (status === 429 || /rate.?limit|too many requests/i.test(text))
    return { kind: "rate-limit", status, transient: true };
  if (status !== undefined && status >= 500)
    return { kind: "provider-unavailable", status, transient: true };
  if (
    /connection|network|fetch failed|econnreset|enotfound|socket|overload|temporar|unavailable/i.test(
      text,
    )
  )
    return { kind: "network", status, transient: true };
  return { kind: "unknown", status, transient: false };
}

export function isTransientAIError(error: unknown): boolean {
  return classifyAIError(error).transient;
}

/** A short, best-effort per-instance cooldown. Not a shared health registry. */
export function providerCooldownMs(error: unknown): number {
  const classification = classifyAIError(error);
  if (!classification.transient) return 0;
  if (classification.kind === "rate-limit") return 30_000;
  if (classification.kind === "timeout" || classification.kind === "network")
    return 10_000;
  return 20_000;
}
