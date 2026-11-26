# PAYDAN production services

## Database

Set `DATABASE_URL` to the Neon pooled connection and `DATABASE_URL_UNPOOLED` to the direct connection. Run `npm run db:migrate` with the direct URL available before deploying application code that depends on a new migration.

## S3 and CloudFront

The S3 bucket stays private. Catalog objects under `catalog/` use the unsigned `MEDIA_CDN_URL`; private `sourcing/` and `return/` objects are authorized by PAYDAN and returned as short-lived CloudFront signed URLs.

Create a CloudFront trusted key group, associate it with the private cache behavior, and set:

- `CLOUDFRONT_KEY_PAIR_ID`
- `CLOUDFRONT_PRIVATE_KEY_BASE64` (the entire PEM private key encoded as base64)
- `CLOUDFRONT_SIGNED_URL_TTL_SECONDS=300`

Keep `S3_ENDPOINT` unset in production. It is only used for the local MinIO fallback.

## Transactional email

Resend can send from `orders@updates.paydan.store` when `updates.paydan.store` is the verified sending domain. Set `MAIL_FROM`, `MAIL_REPLY_TO`, `OPERATIONS_NOTIFICATION_EMAIL`, SMTP credentials, `CRON_SECRET`, and `RESEND_WEBHOOK_SECRET`. Authentication messages attempt immediate SMTP delivery after being stored in the outbox; the scheduled mail worker remains the durable retry path.

Configure the Resend webhook URL as `/api/webhooks/resend`. Subscribe to delivered, delayed, bounced, and complained events. Vercel invokes `/api/cron/mail` and supplies `Authorization: Bearer $CRON_SECRET`.

Schedule all protected worker routes: `/api/cron/mail` every minute for the outbox, `/api/cron/payments` every five minutes for Paystack payment/refund reconciliation, and `/api/cron/media` daily for finalized catalogue orphan cleanup. If the Vercel plan cannot provide the required frequency, use an external scheduler with the same bearer secret. Every route uses an advisory lock and records a sanitized `worker_run`; confirm recent successful runs on **Admin → Jobs & recovery**.

Keep `SITE_INDEXING_ENABLED=false` for previews and during production acceptance. Set `POLICIES_APPROVED_VERSION=2026-10` only after the client approves that exact policy version, then enable indexing after the Admin launch-readiness checklist passes.

After observing each complete staging journey, record its ISO timestamp in `GOOGLE_OAUTH_ACCEPTED_AT`, `STORAGE_ACCEPTED_AT`, `PAYSTACK_ACCEPTED_AT`, `EMAIL_ACCEPTED_AT`, or `AI_ACCEPTED_AT`. These are acceptance evidence flags, not substitutes for credentials; the launch checklist requires both configuration and the relevant observed test.

## Ask PAYDAN

Production uses this bounded route:

1. Direct Groq using `GROQ_MODEL=openai/gpt-oss-20b`.
2. OpenRouter using `OPENROUTER_MODEL=openrouter/free` only when Groq fails before output with a timeout, network error, `408`, `429`, or provider `5xx`.
3. The deterministic PAYDAN catalogue/search/support assistant when external providers remain unavailable or are misconfigured.

Set `AI_PROVIDER_TIMEOUT_MS=12000`. Store `GROQ_API_KEY` and `OPENROUTER_API_KEY` only in Vercel project secrets or a gitignored local environment file. `OPENROUTER_SITE_URL` and `OPENROUTER_APP_NAME` identify PAYDAN to OpenRouter. The application rejects the retired Gateway variables so an old deployment cannot silently use the wrong route.

PAYDAN does not fail over after text, a tool call, or a tool result has reached the client, preventing duplicate cart proposals and mixed-provider replies. It also does not fail over on invalid requests, authorization/authentication failures, malformed tools, or browser cancellation. Logs contain provider/model, latency, token usage, status and a sanitized failure class—not prompts, provider response bodies, secrets or customer PII.

The earlier Groq key was exposed during local inspection. Revoke it before production use, generate a new key, and save the replacement only in the Vercel environment dashboard and a gitignored local file. Do not add `AI_GROQ_*` or `AI_TEST_GROQ_*`; those legacy names are rejected.

The assistant never writes the cart directly. Add, remove, quantity-change and clear-cart requests create short-lived, owner-bound proposals that the signed-in user must explicitly confirm or cancel.
