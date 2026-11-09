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
  if (config.profile !== "production" && process.env.GROQ_API_KEY) {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
    models.push({ name: "groq-test", model: groq.chatModel(config.groqModel) });
  }
  return models;
}
