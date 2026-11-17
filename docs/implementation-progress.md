# PAYDAN implementation status

Updated 16 November 2026. This file records the delivered application behavior. Provider configuration and deployment procedures remain in `SETUP_AND_OPERATIONS.md` and `PRODUCTION_SERVICES.md`.

## Delivered

| Area                | Current implementation                                                                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue authority | PostgreSQL departments govern homepage, navigation, catalogue, search, Ask PAYDAN, cart and checkout visibility. Archived or restricted departments block discovery and purchase while historical order lines remain readable.                                                                |
| Catalogue scale     | Shop, category, search, deals and new-arrivals use an opaque-cursor server endpoint with server-side filters and sorts. Guest DTOs contain no prices; member responses are private. The shared merchandising snapshot is capped and retains account-referenced items.                         |
| Product model       | Department subcategories/facets, structured specifications, variant options, image ordering/alt text/primary selection, slug validation, and trigger-backed product/variant SKU uniqueness are implemented. A recorded media worker removes catalogue objects left unreferenced for 24 hours. |
| Staff authorization | One capability map drives admin paths, navigation, visible controls, commands and specialized APIs. Supplier writes, support notes, fulfilment, refunds, settings, jobs and catalogue writes are independently enforced on the server.                                                        |
| Operations          | Protected mail, payment/refund and media cron routes use advisory locks and durable worker-run records. Jobs & recovery shows queues, dead mail, payment/refund exceptions, recent runs, safe manual reconciliation, dead-mail retry and orphan cleanup.                                      |
| Returns and refunds | New and backfilled orders have immutable line identifiers and SKU/variant snapshots. Return limits and refund amounts resolve the exact order line; ambiguous legacy returns require staff review and duplicate Paystack refunds remain blocked.                                              |
| Merchandising       | Hero CTA links, side banners, alt text, schedule validation, homepage departments, featured/new-arrival collections, storefront identity/contact settings and internal operations recipients are database-controlled. Public cache invalidation follows catalogue/settings writes.            |
| Test buyer          | Test products, orders, sourcing, returns, support and notifications use test-owned record kinds. External mail, Paystack and production operational alerts are suppressed; the dashboard is labelled demonstration data and can be reset to the current fixture version.                      |
| Analytics and audit | Analytics separates gross paid revenue, processed refunds, net revenue, pending payment value, sourcing conversion and return rate, with a date filter. Audit records include actor/capability/source, support cursor pagination and sanitized CSV export.                                    |
| Buyer account       | Dashboard attention items, recently viewed, buy-again, saved finds, active orders, durable notification read state and append-only support conversations are connected to account-owned server data.                                                                                          |
| Connected services  | Health states distinguish unconfigured, configured, verified, degraded and failing. Safe checks cover PostgreSQL, S3, SMTP, Paystack and CloudFront. Explicit acceptance timestamps prevent configuration alone from passing launch readiness.                                                |
| Launch controls     | A Super Admin checklist covers content, inventory, support, policy approval, providers, workers and unresolved alerts. Robots and sitemap output are environment controlled; product sitemap entries remain price-free.                                                                       |

## Verification

Run these checks after every migration or deployment candidate:

```powershell
npm test
npm run typecheck
npm run build
git diff --check
```

The current automated suite exercises the real commerce migrations in PGlite, Better Auth behavior, price/privacy boundaries, capability and catalogue-visibility rules, database SKU uniqueness, public catalogue pagination/detail projection, test-notification isolation, cart and checkout integrity, Paystack verification/idempotency, exact-line returns/refunds, CloudFront media boundaries, origin protection and AI-provider routing.

## External acceptance still required

`migrations/006_operational_completion.sql` must be applied once with the unpooled production Neon connection before deploying this build. The migration is forward-only and adds SKU enforcement, operational indexes, worker runs, notifications, support conversations and legacy order-line backfill.

The application does not mark provider setup as accepted merely because credentials exist. Complete the Google OAuth, S3/CloudFront, Paystack, transactional-email/webhook and Ask PAYDAN staging journeys, then set the corresponding `*_ACCEPTED_AT` ISO timestamps. Schedule mail every minute, payment reconciliation every five minutes and media cleanup daily.

The policy text is intentionally still draft. Replace it with client-approved wording, change each policy status to `Published`, record its approval date, and set `POLICIES_APPROVED_VERSION` to the matching code version. Keep `SITE_INDEXING_ENABLED=false` until the blocking launch checklist passes and the client authorizes indexing.

Real supplier, product, inventory, delivery and support content must be entered through the admin portal. No guessed production price, stock, provider result or policy approval is seeded by this implementation.
