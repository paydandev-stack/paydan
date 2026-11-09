import "server-only";

import { z } from "zod";

const profileSchema = z.enum(["production", "test", "test-last"]);
export type AssistantProfile = z.infer<typeof profileSchema>;

export function assistantConfig() {
  const profile = profileSchema.parse(process.env.AI_PROVIDER_PROFILE || (process.env.NODE_ENV === "production" ? "production" : "test"));
  if (process.env.NODE_ENV === "production" && profile !== "production")
    throw new Error("Direct test AI providers are disabled in production.");
  return {
    profile,
    primaryModel: process.env.AI_PRIMARY_MODEL || "anthropic/claude-haiku-5.5",
    secondaryModel: process.env.AI_SECONDARY_MODEL || "openai/gpt-6-luna",
    groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  };
}

export function isTransientAIError(error: unknown): boolean {
  const value = error as { statusCode?: number; status?: number; name?: string; message?: string };
  const status = value?.statusCode ?? value?.status;
  if (status === 408 || status === 409 || status === 429 || (status && status >= 500)) return true;
  return /timeout|timed out|rate limit|temporar|overload|unavailable|connection|network/i.test(`${value?.name || ""} ${value?.message || ""}`);
}

/** A short, best-effort per-instance cooldown. Not a shared health registry. */
export function providerCooldownMs(error: unknown): number {
  const value = error as { statusCode?: number; status?: number } | null;
  const status = value?.statusCode ?? value?.status;
  if (status === 401 || status === 402 || status === 403 || status === 404) return 60_000;
  return isTransientAIError(error) ? 20_000 : 0;
}
