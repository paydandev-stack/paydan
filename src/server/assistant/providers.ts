import "server-only";

import { z } from "zod";
import { assistantConfig } from "./config";
import type { assistantTools } from "./tools";

export type AssistantModel = {
  name: "groq-direct" | "openrouter-free";
  modelId: string;
  baseUrl: string;
  apiKey: string;
  headers?: Record<string, string>;
};

export type AssistantProviderPart =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolName: string }
  | { type: "tool-result"; toolName: string; output: unknown };

export type AssistantProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type ToolMap = Awaited<ReturnType<typeof assistantTools>>;
type ChatMessage = Record<string, unknown> & { role: string };

class ProviderHttpError extends Error {
  statusCode: number;
  constructor(statusCode: number) {
    super(`AI provider returned HTTP ${statusCode}.`);
    this.name = "ProviderHttpError";
    this.statusCode = statusCode;
  }
}

export function assistantModels(): AssistantModel[] {
  const config = assistantConfig();
  const models: AssistantModel[] = [];
  if (process.env.GROQ_API_KEY?.trim())
    models.push({
      name: "groq-direct",
      modelId: config.groqModel,
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
  if (process.env.OPENROUTER_API_KEY?.trim())
    models.push({
      name: "openrouter-free",
      modelId: config.openRouterModel,
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer": config.openRouterSiteUrl,
        "X-Title": config.openRouterAppName,
      },
    });
  return models;
}

async function requestCompletion({
  candidate,
  messages,
  tools,
  timeoutMs,
  abortSignal,
}: {
  candidate: AssistantModel;
  messages: ChatMessage[];
  tools: ToolMap;
  timeoutMs: number;
  abortSignal?: AbortSignal;
}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  abortSignal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`${candidate.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${candidate.apiKey}`,
        "Content-Type": "application/json",
        ...candidate.headers,
      },
      body: JSON.stringify({
        model: candidate.modelId,
        messages,
        tools: Object.entries(tools).map(([name, definition]) => ({
          type: "function",
          function: {
            name,
            description: definition.description,
            parameters: z.toJSONSchema(definition.inputSchema),
          },
        })),
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });
    if (!response.ok) throw new ProviderHttpError(response.status);
    return (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
  } catch (error) {
    if (timedOut) throw new Error("AI provider request timed out.");
    throw error;
  } finally {
    clearTimeout(timer);
    abortSignal?.removeEventListener("abort", abort);
  }
}

export function providerAttempt({
  candidate,
  system,
  messages,
  tools,
  timeoutMs,
  abortSignal,
}: {
  candidate: AssistantModel;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tools: ToolMap;
  timeoutMs: number;
  abortSignal?: AbortSignal;
}) {
  let resolveUsage: (value: AssistantProviderUsage) => void = () => undefined;
  const usage = new Promise<AssistantProviderUsage>((resolve) => {
    resolveUsage = resolve;
  });
  async function* stream(): AsyncGenerator<AssistantProviderPart> {
    const conversation: ChatMessage[] = [
      { role: "system", content: system },
      ...messages,
    ];
    const totals: AssistantProviderUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    try {
      for (let step = 0; step < 6; step += 1) {
        const result = await requestCompletion({
          candidate,
          messages: conversation,
          tools,
          timeoutMs,
          abortSignal,
        });
        totals.inputTokens! += result.usage?.prompt_tokens || 0;
        totals.outputTokens! += result.usage?.completion_tokens || 0;
        totals.totalTokens! += result.usage?.total_tokens || 0;
        const message = result.choices?.[0]?.message;
        if (!message) throw new ProviderHttpError(503);
        const calls = message.tool_calls || [];
        if (!calls.length) {
          const text = message.content?.trim();
          if (!text) throw new ProviderHttpError(503);
          yield { type: "text-delta", text };
          return;
        }

        conversation.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: calls,
        });
        for (const call of calls) {
          const definition = tools[call.function.name as keyof ToolMap];
          if (!definition) throw new ProviderHttpError(400);
          yield { type: "tool-call", toolName: call.function.name };
          let rawInput: unknown;
          try {
            rawInput = JSON.parse(call.function.arguments || "{}");
          } catch {
            throw new ProviderHttpError(400);
          }
          const input = definition.inputSchema.parse(rawInput);
          const execute = definition.execute as (
            value: typeof input,
          ) => unknown | Promise<unknown>;
          const output = await execute(input);
          yield {
            type: "tool-result",
            toolName: call.function.name,
            output,
          };
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(output),
          });
        }
      }
      throw new ProviderHttpError(422);
    } finally {
      resolveUsage(totals);
    }
  }
  return { stream: stream(), usage };
}
