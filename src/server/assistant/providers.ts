import "server-only";

import { createGateway } from "@ai-sdk/gateway";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { assistantConfig } from "./config";

type AssistantProviderOptions = {
  gateway: {
    models: string[];
    has: string[];
  };
};

export type AssistantModel = {
  name: "vercel-gateway" | "groq-direct";
  modelId: string;
  model: LanguageModel;
  providerOptions?: AssistantProviderOptions;
};

export function assistantModels(): AssistantModel[] {
  const config = assistantConfig();
  const models: AssistantModel[] = [];
  if (config.profile !== "test") {
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY || undefined,
    });
    models.push({
      name: "vercel-gateway",
      modelId: config.primaryModel,
      model: gateway(config.primaryModel),
      providerOptions: {
        gateway: {
          models: [config.secondaryModel],
          has: ["tool-use"],
        },
      },
    });
  }
  // This direct adapter is intentionally independent from Vercel. It is the
  // first external backup when the compound Gateway request fails transiently.
  if (process.env.GROQ_API_KEY?.trim()) {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
    models.push({
      name: "groq-direct",
      modelId: config.groqModel,
      model: groq.chatModel(config.groqModel),
    });
  }
  return models;
}
