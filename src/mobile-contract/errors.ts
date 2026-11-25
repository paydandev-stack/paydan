import { z } from "zod";

/**
 * Stable machine-readable error codes for /api/mobile/v1.
 * `message` is a safe display string; never include secrets, stack traces,
 * provider bodies, or PII beyond the viewer's own account summary.
 */
export const mobileErrorCodes = [
  "unauthenticated",
  "email_unverified",
  "forbidden",
  "not_found",
  "validation",
  "conflict",
  "rate_limited",
  "payload_too_large",
  "checkout_empty",
  "stock_changed",
  "price_changed",
  "pending_payment",
  "payment_failed",
  "payment_pending",
  "proposal_expired",
  "proposal_not_found",
  "media_unavailable",
  "service_unavailable",
  "maintenance",
] as const;

export type MobileErrorCode = (typeof mobileErrorCodes)[number];

export const mobileErrorSchema = z.object({
  code: z.enum(mobileErrorCodes),
  message: z.string().min(1).max(500),
});

export type MobileError = z.infer<typeof mobileErrorSchema>;

/** Map an HTTP status + server message to a stable mobile error code. */
export function toMobileError(status: number, message: string): MobileError {
  const safe = message.slice(0, 500) || "Something went wrong.";
  if (status === 401)
    return {
      code: /not verified|verify your email|verification/i.test(message)
        ? "email_unverified"
        : "unauthenticated",
      message: safe,
    };
  if (status === 403) return { code: "forbidden", message: safe };
  if (status === 404) return { code: "not_found", message: safe };
  if (status === 409) {
    if (/price|total/i.test(message))
      return { code: "price_changed", message: safe };
    if (/stock|availability|available/i.test(message))
      return { code: "stock_changed", message: safe };
    if (/pending payment/i.test(message))
      return { code: "pending_payment", message: safe };
    if (/proposal/i.test(message))
      return { code: "proposal_expired", message: safe };
    return { code: "conflict", message: safe };
  }
  if (status === 413) return { code: "payload_too_large", message: safe };
  if (status === 429) return { code: "rate_limited", message: safe };
  if (status === 503) return { code: "service_unavailable", message: safe };
  return { code: "validation", message: safe };
}
