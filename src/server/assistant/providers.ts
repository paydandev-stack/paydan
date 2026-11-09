import "server-only";

import { createGateway } from "@ai-sdk/gateway";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { assistantConfig } from "./config";

export type AssistantModel = { name: string; model: LanguageModel };

export function assistantModels(): AssistantModel[] {
  const config = assistantConfig();
  const models: AssistantModel[] = [];
  if (config.profile !== "test") {
    const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY || undefined });
    models.push(
      { name: "gateway-primary", model: gateway(config.primaryModel) },
      { name: "gateway-secondary", model: gateway(config.secondaryModel) },
    );
  }
  // Groq is an additional production fallback after both Gateway models.
  // Test profile continues to use Groq alone.
  if (process.env.GROQ_API_KEY?.trim()) {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
    models.push({ name: "groq-fallback", model: groq.chatModel(config.groqModel) });
  }
  return models;
}
