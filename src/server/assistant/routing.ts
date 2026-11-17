import "server-only";

import { classifyAIError } from "./config";

export type ProviderAttempt<TPart, TUsage> = {
  stream: AsyncIterable<TPart>;
  usage?: PromiseLike<TUsage>;
};

export type ProviderAttemptLog<TCandidate> = {
  candidate: TCandidate;
  error: unknown;
  emitted: boolean;
  elapsedMs: number;
  fallbackAttempted: boolean;
};

export type ProviderRouteResult<TCandidate, TUsage> =
  | {
      status: "success";
      candidate: TCandidate;
      attempts: number;
      elapsedMs: number;
      usage?: TUsage;
    }
  | {
      status: "partial" | "terminal" | "exhausted" | "aborted";
      candidate?: TCandidate;
      error?: unknown;
      attempts: number;
    }
  | { status: "unconfigured"; attempts: 0 };

/**
 * Routes a stream without ever replaying a provider after meaningful output.
 * Only transient pre-output failures may advance to the next candidate.
 */
export async function routeProviderStreams<TCandidate, TPart, TUsage>({
  candidates,
  attempt,
  isMeaningful,
  onPart,
  onFailure,
  abortSignal,
  now = Date.now,
}: {
  candidates: TCandidate[];
  attempt: (
    candidate: TCandidate,
  ) => ProviderAttempt<TPart, TUsage> | Promise<ProviderAttempt<TPart, TUsage>>;
  isMeaningful: (part: TPart) => boolean;
  onPart: (part: TPart, candidate: TCandidate) => void | Promise<void>;
  onFailure?: (details: ProviderAttemptLog<TCandidate>) => void;
  abortSignal?: AbortSignal;
  now?: () => number;
}): Promise<ProviderRouteResult<TCandidate, TUsage>> {
  if (!candidates.length) return { status: "unconfigured", attempts: 0 };

  for (const [index, candidate] of candidates.entries()) {
    const startedAt = now();
    let emitted = false;
    try {
      const result = await attempt(candidate);
      for await (const part of result.stream) {
        if (isMeaningful(part)) emitted = true;
        await onPart(part, candidate);
      }
      if (!emitted) {
        const emptyResponse = new Error(
          "AI provider finished without text or tool results.",
        ) as Error & { statusCode: number };
        emptyResponse.statusCode = 503;
        throw emptyResponse;
      }
      let usage: TUsage | undefined;
      try {
        usage = result.usage ? await result.usage : undefined;
      } catch {
        // Usage metadata is best effort and must not fail a completed answer.
      }
      return {
        status: "success",
        candidate,
        attempts: index + 1,
        elapsedMs: now() - startedAt,
        usage,
      };
    } catch (error) {
      const externallyAborted = Boolean(abortSignal?.aborted);
      const transient = classifyAIError(error).transient;
      const fallbackAttempted =
        !emitted &&
        !externallyAborted &&
        transient &&
        index < candidates.length - 1;
      onFailure?.({
        candidate,
        error,
        emitted,
        elapsedMs: now() - startedAt,
        fallbackAttempted,
      });

      if (externallyAborted)
        return {
          status: "aborted",
          candidate,
          error,
          attempts: index + 1,
        };
      if (emitted)
        return {
          status: "partial",
          candidate,
          error,
          attempts: index + 1,
        };
      if (!transient)
        return {
          status: "terminal",
          candidate,
          error,
          attempts: index + 1,
        };
      if (!fallbackAttempted)
        return {
          status: "exhausted",
          candidate,
          error,
          attempts: index + 1,
        };
    }
  }

  return { status: "exhausted", attempts: candidates.length };
}
