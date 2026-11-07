export async function api<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};

  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!response.ok)
        throw new Error(
          response.status >= 500
            ? "This service is temporarily unavailable. Please try again."
            : "The request could not be completed. Please try again.",
        );
      throw new Error("The server returned an invalid response.");
    }
  }

  if (!response.ok) {
    const nestedError =
      typeof data.error === "object" && data.error
        ? (data.error as Record<string, unknown>).message
        : undefined;
    const message = [data.error, data.message, nestedError].find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
    throw new Error(message || "The request failed. Please try again.");
  }
  return data as T;
}
