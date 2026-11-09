# PAYDAN setup and operations

Updated 7 November 2026. Application: `paydan-next`. The implementation uses Neon PostgreSQL, private AWS S3 with optional CloudFront catalog delivery, Google-only OAuth, email/password authentication, and Paystack. The AI provider remains undecided. This document describes implemented code and the external setup still required; it is not a claim that every live service has been commissioned.

## Local setup

Use Node.js 24 LTS and the checked-in `package-lock.json`. From the application directory:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Populate `.env.local` privately; never commit it or send secret keys in chat. No secret uses a `NEXT_PUBLIC_` name. Run `npm run config:check` to report missing variable names without printing values. This checks presence, not connectivity.

| Service        | Required configuration                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| PostgreSQL     | Pooled `DATABASE_URL`; direct `DATABASE_URL_UNPOOLED` for migrations; verified TLS settings                 |
| Authentication | `BETTER_AUTH_URL` (canonical exact origin, HTTPS in production), `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated additional custom/preview origins), `BETTER_AUTH_SECRET` (at least 32 random characters) |
| Google         | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                  |
| Paystack       | `PAYSTACK_SECRET_KEY`; use a test key for staging                                                           |
| S3             | `AWS_REGION`, `S3_BUCKET`; prefer an IAM role, or local AWS SDK credentials                                 |
| Media CDN      | `MEDIA_CDN_URL`, the HTTPS CloudFront/custom-domain base URL for the private S3 origin                      |
| Email          | `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, and credentials when required by the SMTP host                       |
| AI, optional   | `AI_CHAT_COMPLETIONS_URL`, `AI_API_KEY`, `AI_MODEL`                                                         |

Initialize the schema and start the app:

```powershell
npm run db:migrate
npm run dev
```

The migration runner applies versioned commerce SQL and Better Auth's database schema. It automatically prefers `DATABASE_URL_UNPOOLED` when supplied so DDL and advisory locks bypass PgBouncer; application requests continue using the pooled `DATABASE_URL`. Back up an existing database before migrating and run migrations as one deployment job. Use a separate migration credential if the production runtime has reduced database permissions. The application connection pool allows ten connections per process; size the database pool for the number of replicas.

With no database configured, the application provides a sanitized public catalogue preview. Authentication, purchases and private account data are unavailable. This preview never seeds a production database.

For an **empty test database only**, explicitly set `ALLOW_SAMPLE_CATALOG=true`, then run `npm run db:seed`. It seeds sample catalogue records and suppliers, not customer accounts or orders. Shipping is inactive and stock is zero until deliberately configured. The Docker local stack additionally requires `ALLOW_LOCAL_SEED=true` and runs `db:seed:local-state` plus `db:seed:users`; those guarded steps create local stock, activate Lagos delivery, and create the two documented test accounts. Do not use any of this data as real pricing or confirmed inventory.

## Identity and staff access

Create a Google Web OAuth client. Add your exact app origin and the redirect URI:

```text
https://your-domain.example/api/auth/callback/google
```

Use the equivalent `http://localhost:3000/api/auth/callback/google` for local development. Configure Google's consent screen and test users before testing. Email/password accounts require email verification; passwords have a 12-character minimum. Password resets revoke prior sessions. Google is the only OAuth provider implemented. Existing password users can explicitly link Google from their profile after signing in; accounts are not silently merged because email addresses match.

Run the mail worker to deliver verification/reset messages. After creating and verifying the first operator account:

```powershell
npm run admin:bootstrap -- verified-operator@example.com
```

This is a privileged database operation, not a public registration option. In `/admin/settings/team`, a Super Admin can add staff, assign roles, and activate access after the account is verified. Invited/suspended records grant no access. Roles are checked server-side on every request. Protect Super Admin accounts and avoid suspending the last administrator.

## Private S3 and catalog CDN media

Create a private bucket with Block Public Access enabled, encryption at rest and versioning. Grant the application IAM access to GetObject, PutObject and DeleteObject only in its own bucket/prefixes: `incoming/`, `catalog/`, `sourcing/`, `return/`. The application needs no public bucket policy. Configure CORS for your exact production/staging origins and local development origin; allow POST, GET, HEAD and the required content headers. A typical rule is:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.example", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
```

Remove localhost from the production bucket rule. Add a lifecycle expiry for abandoned objects under `incoming/`. Do not expire finalized private evidence without the business's approved retention policy.

Create a CloudFront distribution with the S3 bucket as a regular origin and configure Origin Access Control (OAC). Keep S3 Block Public Access enabled and grant only the CloudFront distribution permission to read `catalog/*`. Point a stable custom hostname such as `media.example.com` to the distribution, issue its TLS certificate, and set that HTTPS base URL as `MEDIA_CDN_URL` in every Vercel environment. Redeploy after setting it because the hostname is also added to Next.js image configuration at build time. Do not expose `incoming/`, `sourcing/`, or `return/` through a public CloudFront behavior.

Uploads accept JPG/PNG/WebP up to 5 MiB. A two-minute signed POST fixes the size and MIME type. Finalization verifies actual bytes, decodes with a pixel limit, strips metadata, and writes a new immutable WebP key. Catalog objects receive a one-year immutable cache policy and, when `MEDIA_CDN_URL` is configured, product records receive the CloudFront URL directly. Legacy `/api/media/{id}` catalog references redirect to CloudFront with shared-cache headers. Sourcing/return evidence continues to require its owner or an authorized staff session and receives a 60-second S3 URL with `private, no-store`. Anyone holding an issued private URL can use it for its short lifetime; do not log or share it.

Anonymous product data is delivered separately from account state at `/api/catalog`. It contains price-free catalogue DTOs only and is eligible for short shared CDN caching. `/api/store`, authenticated prices, carts, orders, addresses, inventory operations, and private evidence remain `private, no-store`. Catalog mutations invalidate the server data-cache tag; the public CDN response also has a short TTL so external cache propagation is bounded.

## Catalogue, stock and sourcing

Use the admin console to create departments, active suppliers, products, variants and uploaded media. Publish only verified product information. Set supplier-confirmed quantities in `/admin/inventory`; activate delivery zones with real fees in shipping settings. Checkout rejects unsupported destinations, unconfirmed stock, unavailable variants and changed totals. Monetary payment calculations use integer kobo.

The sourcing workflow is: customer request → procurement review → draft quote → send → customer acceptance → convert to unpaid order → procurement confirms supplier availability and actual item costs → customer reviews delivery and pays. Staff cannot accept a customer's quote for them. Supplier instructions and fulfillment must wait for verified payment. Customer tracking exposes delivery groups, not supplier contacts, internal notes or costs.

## Paystack

Set a Paystack **test** secret first. Configure the public webhook endpoint:

```text
https://your-domain.example/api/paystack/webhook
```

The server initializes checkout and supplies the callback URL. The browser never chooses a payable amount or marks an order paid. Verification checks the stored reference, amount, NGN currency, customer email and order metadata. Raw webhook bodies are authenticated using Paystack's HMAC-SHA512 signature. Repeat callbacks/webhooks do not duplicate fulfillment or payment email jobs.

Stock is reserved transactionally before checkout. Only verified success consumes that reservation; verified failed/abandoned transactions release it once. Pending/unknown payments stay pending. Do not expire reservations solely because a browser closed. There are no supplier split settlements or automatic supplier payouts in this implementation.

Approved returns can be refunded by an Order Manager or Super Admin through the original Paystack transaction. Refund amounts allocate the order discount proportionally and exclude delivery. Provider verification, not an admin dropdown, changes refund/payment status. A partially refunded order remains paid while its return records show the refunded items.

If an initialization/refund request times out after Paystack may have accepted it, do not blindly resubmit or create a second refund. Inspect the stored reference and Paystack dashboard, then reconcile the original operation. A refund without a provider ID requires manual operational reconciliation. A sourced order's failed payment attempt also requires team reconciliation/re-quoting rather than creating an unchecked second payment. Late success after a previously released reservation fails closed for operator review. Keep these cases in the support runbook until a dedicated reconciliation console is added.

## Email and scheduled jobs

Configure a verified sender domain with SPF/DKIM and the mail provider's recommended DMARC policy. Port 465 uses implicit TLS; other SMTP ports require STARTTLS. Schedule these server-side commands with the same environment as the application:

```powershell
# Every minute
npm run worker:mail
# Every five minutes
npm run worker:payments
```

The mail worker processes up to 50 jobs per run, with locking and exponential retry, stopping after eight failed attempts. Sent message bodies are cleared. Delivery is at least once: a process crash between SMTP acceptance and database commit may duplicate an email. Monitor exhausted retries, stale pending payments, refunds awaiting verification, stock reservations and job failures. Reconciliation processes up to 100 pending payments per run; investigate long-lived entries so they do not starve newer work. These scripts do not register a scheduler themselves.

## AI provider handoff

No provider has been chosen or enabled. Until configured, the global chat truthfully says live AI is unavailable and links to browsing/sourcing. It does not pretend a model answered.

The adapter expects an HTTPS chat-completions endpoint supporting JSON-object responses. A provider with a different protocol needs an adapter change. The model receives authorized catalogue/department data, the member's cart and limited own-order status; it receives no supplier costs, supplier contacts or delivery addresses. User messages may themselves contain personal information, so review the selected provider's data handling and retention before enabling it.

Replies can propose products, variants and quantities. A user must confirm each cart mutation, which goes through the same server command and cart as the regular UI. The model cannot take payment, place orders or alter permissions. Guest replies use controlled catalogue explanations to avoid invented prices; member price data comes from authorized catalogue context. Chat history is held in sessionStorage, partitioned by owner, with up to 16 recent turns sent per request. It is cleared on sign-out/account change; a guest thread may carry into the first sign-in. No server chat archive is implemented.

## Deployment and acceptance

Run `npm test`, `npm run typecheck`, and `npm run build`. On Vercel, deploy Functions to London (`lhr1`) to match the Neon and S3 `eu-west-2` resources. Serve behind HTTPS using the exact configured origin. Restrict proxy body sizes and configure trusted proxy/IP handling for deployment. API responses containing account state are private/no-store. Never cache those responses at a CDN. Host the Node runtime with PostgreSQL/SMTP/AWS/Paystack egress and enough memory for Sharp image processing.

Run `npm run test:smoke` against a local preview at port 3107, or set `SMOKE_BASE_URL` to the intended test server. This checks public routes and anonymous API denial; it does not create users or payments.

Before accepting production launch, use staging credentials to exercise email verification/reset, Google new/existing-account linking, two-account isolation, each staff role, S3 upload/private download denial, Paystack success/failure/duplicate webhook/reload, sourced checkout, partial refund, SMTP retries, and the chosen AI provider. Test the signed-in desktop/mobile flows with real staging data. The automated PGlite suite does not replace a deployed PostgreSQL concurrency/TLS test or real provider contract tests.

Publish real policies, support details, supplier availability, shipping terms and return rules approved by the business. Current policy copy remains marked draft. Establish PostgreSQL backups/PITR, S3 versioning, restoration drills, error monitoring and retention procedures. Entity data uses owner-indexed JSONB records with separate payment/inventory/receipt tables; large catalogues will need pagination and focused queries beyond the current snapshot approach.

For rollback, keep the prior application build and a pre-migration backup. Prefer compatible forward fixes. Do not automatically drop new tables or replay financial operations. Reconcile Paystack independently before restoring payment-related records.

## Reference documentation

Implementation references: [Better Auth](https://www.better-auth.com/docs/installation), [Paystack payment verification](https://paystack.com/docs/payments/verify-payments/), [Paystack webhooks](https://paystack.com/docs/payments/webhooks/), [AWS S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), and [CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html). Use the versions pinned in the lockfile when maintaining this application.
