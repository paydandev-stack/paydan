# PAYDAN CloudFront and Transactional Email Implementation Plan

## Purpose

Finish the production media-delivery and transactional-email work so that:

- public product catalogue images are delivered efficiently through CloudFront;
- private customer and operations media is delivered through short-lived CloudFront signed URLs;
- customers receive reliable emails as payments, orders, sourcing requests, returns, and refunds change state;
- the PAYDAN client/operations team receives the actionable transaction notifications it needs;
- queued messages are actually processed in the Vercel production environment;
- provider retries and duplicate webhooks do not send duplicate emails; and
- credentials and private signing keys remain server-only and out of Git.

## Existing Foundation

The application already has:

- AWS SDK v3 S3 integration using `@aws-sdk/client-s3`;
- presigned S3 browser uploads;
- 60-second S3 signed downloads for private media;
- public catalogue URL generation from `MEDIA_CDN_URL`;
- a PostgreSQL `mail_outbox` table;
- a Nodemailer SMTP worker with retry/backoff;
- customer emails for authentication, payment confirmation, sourcing acknowledgements, quotations, and order fulfilment updates; and
- verified Paystack-controlled payment state transitions.

The missing work is CloudFront signing, complete transaction-event coverage, operations recipients, Reply-To support, production queue scheduling, email templates, delivery telemetry, and the corresponding tests and documentation.

## Architecture Decisions

### Media delivery

1. Keep the S3 bucket private and allow CloudFront to access it with Origin Access Control (OAC).
2. Keep `catalog/*` publicly readable through CloudFront. Product images are intentionally visible on the public storefront, so signing every catalogue image would add expiring URLs and complexity without protecting private information.
3. Require CloudFront signed URLs for `sourcing/*`, `return/*`, and any future private paths such as `invoices/*` or `receipts/*`.
4. Generate signatures only on the server after the existing ownership/role authorization checks have passed.
5. Use a trusted CloudFront key group rather than a legacy root-account CloudFront key pair.
6. Use a short default expiry, initially five minutes, configurable within a safe bounded range.

### Email delivery

1. Keep the existing provider-neutral Nodemailer/SMTP transport for the first production release.
2. Configure that transport with Resend SMTP credentials. A Resend SDK migration is not required to deliver the requested functionality.
3. Continue using a durable PostgreSQL outbox so application state and its email events can be committed together.
4. Add deterministic event keys so Paystack retries, repeated admin actions, and worker retries cannot create duplicate messages.
5. Send customer and operations messages as separate outbox records. A failure to deliver one must not suppress or roll back the other.
6. Use verified backend events and stored state transitions as email triggers. Never send a payment-success email solely because the browser reached a success page.
7. Use a real monitored mailbox as `Reply-To`. Resend receiving/inbound processing is a separate optional capability.

## Phase 0 — Credential and Repository Safety

- Confirm `.gitignore` excludes:
  - `*.pem`;
  - `*accessKeys.csv`;
  - downloaded Google OAuth client-secret JSON files;
  - `.env.local` and `.env.vercel`;
  - all other real credential exports.
- Keep `rsa_key_private.pem` and AWS access-key CSV files untracked.
- If any secret has ever been committed or shared publicly, revoke and rotate it before deployment.
- Store the CloudFront private key in Vercel as an encrypted Production/Preview secret, preferably base64 encoded to avoid multiline parsing problems.
- Never add a real private key, Resend API key, AWS secret, Paystack key, or webhook secret to `.env.example`.
- Restrict the Vercel AWS IAM principal to the required S3 bucket and actions only.

## Phase 1 — CloudFront Distribution Configuration

This phase is performed in AWS before enabling application-side signing.

1. Confirm the distribution uses the private S3 bucket as its origin through OAC.
2. Confirm direct public S3 access is blocked.
3. Create or use an RSA-2048/ECDSA-256 public/private key pair.
4. Upload only the public key to CloudFront.
5. Add that public key to a trusted key group.
6. Configure cache behaviours:
   - `catalog/*`: OAC origin, no trusted-key requirement, long-lived immutable caching;
   - `sourcing/*`: OAC origin, trusted key group required;
   - `return/*`: OAC origin, trusted key group required;
   - future private prefixes: trusted key group required.
7. Attach the custom media domain and valid ACM certificate if using `media.paydan.store`.
8. Test that unsigned private-object requests are rejected while public catalogue objects remain available.

## Phase 2 — CloudFront Signer Implementation

### Dependencies and configuration

- Add `@aws-sdk/cloudfront-signer`.
- Add placeholders and descriptions to `.env.example`:

```env
MEDIA_CDN_URL=
CLOUDFRONT_KEY_PAIR_ID=
CLOUDFRONT_PRIVATE_KEY_BASE64=
CLOUDFRONT_SIGNED_URL_TTL_SECONDS=300
```

- Treat `CLOUDFRONT_KEY_PAIR_ID` as the CloudFront public-key/key-pair identifier expected by the signer, not as an IAM access-key ID.
- Validate the CDN URL as HTTPS in production.
- Decode the base64 private key only inside server-only code.
- Reject missing, malformed, or out-of-range signer configuration with a controlled service-configuration error.

### Code changes

- Create a server-only CloudFront signing module, for example `src/server/cloudfront.ts`.
- Expose a focused function such as `signedPrivateMediaUrl(objectKey, expiresAt)`.
- Build the unsigned URL from the validated CDN base and encoded object key.
- Update `readMedia()` in `src/server/media.ts`:
  - retain the existing owner/role authorization checks;
  - return the normal CDN URL for catalogue media;
  - return a CloudFront signed URL for authorized sourcing and return media;
  - stop using a browser-reachable S3 signed GET URL in production;
  - retain the S3 signer only as a documented local-development fallback if needed for MinIO.
- Do not expose the private key, signing policy, or signer helper to client components.
- Preserve private `Cache-Control` response headers for authenticated API responses that issue signed URLs.

### CloudFront acceptance criteria

- Public catalogue images load without a signature.
- An unsigned private CloudFront URL returns access denied.
- An authorized owner or operations role receives a working signed URL.
- An unauthorized user receives no object URL.
- The signed URL stops working after expiry.
- No S3 bucket URL or private key is visible in client bundles or API payloads.

## Phase 3 — Mail Outbox Upgrade

Add a migration that safely extends the current table instead of deleting existing queued messages.

Recommended fields:

- `event_key text UNIQUE` — deterministic application idempotency key;
- `event_type text` — e.g. `payment.succeeded`;
- `audience text` — `customer`, `operations`, or `security`;
- `template_key text`;
- `template_data jsonb`;
- `reply_to text`;
- `provider_message_id text`;
- `claimed_at timestamptz` and `claim_token text` for short worker leases;
- `delivered_at`, `bounced_at`, and `complained_at` if Resend event webhooks are enabled.

Implementation requirements:

- Preserve the current `recipient`, `subject`, `body`, retry, and sent fields during migration.
- Add a unique constraint on `event_key` and enqueue with `ON CONFLICT DO NOTHING`.
- Do not hold a database transaction open while making the external SMTP network request.
- Claim a small batch using `FOR UPDATE SKIP LOCKED`, commit the claim, send it, then record success or retry.
- Clear or minimize stored sensitive message content after successful delivery where practical.
- Record sanitized provider errors for operators without leaking SMTP credentials or customer data.

## Phase 4 — Email Service and Templates

Create a cohesive server-only mail package, for example:

- `src/server/mail/queue.ts` — enqueue and idempotency;
- `src/server/mail/templates.ts` — subject, HTML, and plain-text rendering;
- `src/server/mail/transport.ts` — Nodemailer/Resend SMTP configuration;
- `src/server/mail/worker.ts` — claim, send, retry, and record result;
- `src/server/mail/events.ts` — domain-event-to-recipient mapping.

Required behaviour:

- Send both HTML and plain-text bodies.
- Use PAYDAN-branded, mobile-responsive templates.
- Escape all user-supplied template content.
- Add `replyTo: MAIL_REPLY_TO` to transactional emails.
- Add a deterministic `Resend-Idempotency-Key` SMTP header.
- Use a stable message ID derived from the outbox/event record.
- Include order/reference numbers, the current status, a concise next step, and a safe dashboard link.
- Do not include full addresses, secrets, card details, or sensitive operations notes in email.

## Phase 5 — Notification Event Matrix

| Event | Customer | Client/operations | Trigger |
| --- | --- | --- | --- |
| Account verification/password reset | Yes | No | Better Auth request |
| Checkout/payment initiated | Optional receipt of pending order | No | Payment record created |
| Payment succeeded | Yes | Yes: new paid order | Verified Paystack event/API verification |
| Payment failed/abandoned | Yes | Optional exception alert | Verified Paystack status |
| Order processing | Yes | No | Valid fulfilment transition |
| Order sourcing | Yes | Optional procurement alert | Valid fulfilment transition |
| Order partially packed | Yes | No | Valid fulfilment transition |
| Order dispatched | Yes, include tracking when present | No | Valid fulfilment transition |
| Order delivered | Yes | Optional completion summary | Valid fulfilment transition |
| Order cancelled | Yes | Yes | Authorized cancellation transition |
| Sourcing request submitted | Acknowledgement | Yes: new request | Request committed |
| Sourcing quotation ready | Yes | No | Quote marked sent |
| Quotation accepted | Yes | Yes | Acceptance committed |
| Return submitted | Acknowledgement | Yes: new return | Return committed |
| Return approved/rejected | Yes | Optional exception summary | Review committed |
| Refund submitted | Yes | Yes | Paystack refund request accepted |
| Refund processed/failed | Yes | Yes | Verified Paystack refund status |
| Support request submitted | Acknowledgement | Yes | Ticket committed |

Recipient rules:

- Customer messages go to the authenticated/stored customer email associated with the transaction.
- Operations messages go to `OPERATIONS_NOTIFICATION_EMAIL` and may support a validated comma-separated list.
- Reply-To is `MAIL_REPLY_TO`, a real mailbox monitored by the PAYDAN client or support team.
- An operations address must never be accepted from a browser request.
- Every event key should include the domain record, transition, audience, and version, for example `order:{id}:payment-succeeded:customer:v1`.

## Phase 6 — Resend and DNS Configuration

### Sending

1. Verify either `paydan.store` or a dedicated transactional subdomain such as `updates.paydan.store` in Resend.
2. Copy the exact SPF, DKIM, and Return-Path records generated by Resend into the authoritative DNS provider.
3. Do not proxy email-related CNAME records through Cloudflare.
4. Add and monitor DMARC, initially with a reporting policy before enforcing quarantine/reject.
5. Do not replace existing Google Workspace or other mailbox MX records merely to send through Resend.

Recommended production variables when the root domain is the verified Resend domain:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=
MAIL_FROM=PAYDAN <orders@paydan.store>
MAIL_REPLY_TO=support@paydan.store
OPERATIONS_NOTIFICATION_EMAIL=
```

If `updates.paydan.store` is separately verified, `MAIL_FROM` may instead be:

```env
MAIL_FROM=PAYDAN <orders@updates.paydan.store>
```

### Receiving replies

- A normal Reply-To mailbox does not need Resend receiving records; it only needs to exist at the mailbox provider used by the client.
- If PAYDAN later needs replies ingested into the application, enable Resend Receiving on a dedicated subdomain, add the exact receiving MX record Resend provides, and implement a signature-verified inbound webhook.
- Do not point the root domain's MX to Resend if that would disrupt an existing Google Workspace or other inbox service.

## Phase 7 — Vercel Mail Processing

The current `worker:mail` script is not automatically run by Vercel. Add a production-safe execution path:

1. Extract reusable batch-processing logic from `scripts/mail-worker.ts`.
2. Add a server-only endpoint such as `POST /api/cron/mail`.
3. Protect the endpoint with `CRON_SECRET` and reject all unauthenticated requests.
4. Configure Vercel Cron or another trusted scheduler to call it at an interval supported by the selected Vercel plan.
5. Process a bounded batch and stop before the function timeout.
6. Make concurrent invocations safe using outbox leases and `SKIP LOCKED`.
7. Add structured counts for claimed, sent, retried, permanently failed, and skipped messages.
8. Add an operations view or documented SQL query for failed/dead-letter messages.

Additional variables:

```env
CRON_SECRET=
MAIL_BATCH_SIZE=25
MAIL_MAX_ATTEMPTS=8
```

## Phase 8 — Resend Delivery Webhooks

Recommended after outbound sending is stable:

- Add a Resend webhook endpoint for delivered, delayed, bounced, and complained events.
- Verify every webhook signature before processing it.
- Store webhook event IDs with a unique constraint for idempotency.
- Update outbox delivery state using the provider message ID.
- Flag hard bounces/complaints and stop repeatedly emailing suppressed recipients.
- Surface delivery failures in operations without exposing customer data in logs.

## Phase 9 — Testing

### Unit tests

- CloudFront signer configuration parsing and private-key decoding.
- Signed URL expiry and required signature parameters.
- Authorization before signing private media.
- Catalogue URL remains unsigned.
- Template rendering and HTML escaping.
- Customer/operations recipient selection.
- Reply-To and idempotency headers.
- Duplicate event keys produce one outbox record.
- Retry/backoff and permanent-failure behaviour.

### Integration tests

- Paystack success produces exactly one customer and one operations email.
- Replayed Paystack webhook does not duplicate either message.
- Every fulfilment transition produces the correct customer update.
- Return and refund transitions produce the configured customer/operations pair.
- Multiple workers do not send the same row.
- A failed SMTP request remains retryable without rolling back the transaction state.
- Resend SMTP accepts a message from the verified sender.
- CloudFront rejects unsigned private paths and accepts authorized signed URLs.

### Production smoke test

1. Use a real test customer and low-value Paystack test transaction.
2. Confirm the customer payment email and client new-order email arrive.
3. Move the order through every fulfilment state and verify expected messages.
4. Confirm Reply-To opens the monitored client mailbox.
5. Confirm the Resend dashboard shows the messages and delivery status.
6. Confirm private media links expire and public product images continue to cache.

## Rollout Order

1. Secure/ignore local credentials and confirm no secret is tracked.
2. Configure CloudFront OAC, behaviours, public key, and trusted key group.
3. Deploy signer code with private-media signing behind configuration validation.
4. Apply the mail-outbox migration.
5. Deploy the unified mail queue, templates, event matrix, and operations recipients.
6. Verify the chosen Resend sending domain and configure SMTP secrets in Vercel.
7. Deploy and schedule the protected mail processor.
8. Complete end-to-end Paystack/order/return/refund QA.
9. Enable Resend delivery webhooks and monitoring.
10. Rotate keys on a documented schedule and review failed outbox messages operationally.

## Definition of Done

- No production secret or private key is committed to Git.
- The S3 bucket is private and accessed by users only through CloudFront or authorized upload flows.
- Public product images use stable CDN URLs.
- Private media uses short-lived CloudFront signed URLs after server-side authorization.
- A verified Paystack payment sends one customer receipt and one client new-order notification.
- All customer-visible order, sourcing, return, cancellation, and refund states have appropriate emails.
- `Reply-To` reaches a monitored client mailbox.
- The production scheduler processes the outbox without a permanently running Vercel process.
- Duplicate provider events do not create duplicate emails.
- Failed messages retry safely and are visible to operations.
- Automated tests and a production smoke test cover the complete workflow.
