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

Resend can send from `orders@updates.paydan.store` when `updates.paydan.store` is the verified sending domain. Set `MAIL_FROM`, `MAIL_REPLY_TO`, `OPERATIONS_NOTIFICATION_EMAIL`, SMTP credentials, `CRON_SECRET`, and `RESEND_WEBHOOK_SECRET`.

Configure the Resend webhook URL as `/api/webhooks/resend`. Subscribe to delivered, delayed, bounced, and complained events. Vercel invokes `/api/cron/mail` and supplies `Authorization: Bearer $CRON_SECRET`.

## Ask PAYDAN

Production uses `AI_PROVIDER_PROFILE=production`: AI Gateway primary, then AI Gateway secondary, then the deterministic assistant. Vercel OIDC can authenticate Gateway automatically; `AI_GATEWAY_API_KEY` is useful outside Vercel. Direct Groq is accepted only in non-production profiles:

- `AI_PROVIDER_PROFILE=test`: Groq, then deterministic fallback.
- `AI_PROVIDER_PROFILE=test-last`: Gateway primary, Gateway secondary, Groq, then deterministic fallback.

The assistant never writes the cart directly. It stores a short-lived proposal that the signed-in user must explicitly confirm.
