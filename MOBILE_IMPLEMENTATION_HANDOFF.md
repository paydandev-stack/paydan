# PAYDAN Mobile Implementation Handoff

Date: 2026-11-21

## Status

The code-level buyer mobile implementation is complete in both repositories. The web/API test suite, mobile unit tests, TypeScript checks, lint, Expo config, and Next.js production build all pass.

It is not yet production-ready in the literal sense of the plan, because live staging flows, physical-device QA, EAS builds, real Google OAuth, real Paystack redirects, remote push delivery, and iOS signing/Universal Links have not been run here. Those items are listed explicitly below.

## File-level change summary

### paydan-next (backend and web)

- Added docs/mobile-api-gap-report.md with the Phase 0 audit and service reuse map.
- Added src/mobile-contract/schemas.ts and errors.ts as the shared DTO, input, pagination, and error contract. No server modules or secrets are exported.
- Added src/app/api/mobile/v1/ with 19 buyer-only endpoints: bootstrap, catalog, departments, products/[slug], cart, checkout/initialize, payments/[reference], payments/[reference]/reconcile, orders, orders/[id], sourcing, profile, addresses, wishlist, assistant, assistant/proposals/[id]/confirm, devices/push-token, devices/push-preferences, and media/upload-url.
- Added src/server/mobile-http.ts for viewer resolution, mobile error envelopes, private no-store headers, public catalogue caching, rate limiting, and request-body validation.
- Added src/server/mobile-catalog.ts for viewer-scoped catalogue projections that hide guest prices and supplier fields.
- Added src/server/push/queue.ts and worker.ts, src/app/api/cron/push/, migrations/007_push_tokens.sql, and migrations/008_push_outbox.sql for durable push fan-out and receipt handling.
- Updated src/server/auth.ts with the official Better Auth Expo server integration while preserving browser sessions.
- Updated src/server/origins.ts with the explicit MOBILE_APP_SCHEMES return-URL allowlist, Better Auth Expo origins for Expo Go and native builds, and mobile return-URL validation.
- Updated src/server/payments.ts so checkout returns the server reference, mobile return URLs are accepted, and resumePayment returns the payment reference consistently.
- Updated src/server/notifications.ts and src/server/workers.ts to enqueue push from the same durable domain events used by email.
- Updated src/app/api/products/route.ts and src/app/api/products/[slug]/route.ts for the mobile-safe catalogue behavior.
- Updated package.json and package-lock.json for the Expo/Better Auth packages.
- Updated .env.example with MOBILE_APP_SCHEMES and server-only EXPO_ACCESS_TOKEN.
- Added tests/mobile-api.test.ts and updated tests/commerce.test.ts. The mobile suite covers guest price hiding, viewer isolation, idempotent cart replay, proposal ownership, forged references, return-URL allowlisting, push ownership, and payment reconciliation.

### paydan-mobile (Expo app)

- Replaced the scaffold with a TypeScript Expo Router application under src/app/ only. The stale duplicate root app route tree was removed.
- Added src/contract/ as a vendored copy of the DTO and error contract; no Next.js server modules are imported by the app bundle.
- Added src/Api.ts, src/Auth.ts, src/providers/AuthProvider.tsx, and src/hooks/useMobileQueries.ts for session-aware TanStack Query data access, UUID idempotency keys, and redacted API errors.
- Added src/lib/id.ts, src/lib/log.ts, src/lib/deeplinks.ts, src/lib/assistant.ts, and src/components/ErrorBoundary.tsx.
- Added src/theme.ts, src/ui.tsx, and src/components/ for native PAYDAN-styled primitives, catalogue cards, and assistant tool UI.
- Implemented five tabs: Home, Departments, Ask PAYDAN, Cart, and Account.
- Implemented discovery, product detail, guest price hiding, cart, wishlist, recently viewed, checkout, Paystack handoff, payment verification, orders, order tracking, sourcing, profile, notification preferences, first-run onboarding, collection/sort filters, and auth screens.
- Wired checkout to request a server quote first, send a UUID key and full address, open Paystack in a secure browser, and treat status as pending until the server verifies the exact reference.
- Wired assistant streaming with cancellation, typed tool results, explicit proposal confirmation, bounded in-memory history, and reset on account change.
- Wired Expo push token registration, device-level removal, and backend preference categories marketing, sourcing, and support.
- Added app.json native config: paydan scheme, Android App Link intent filter, iOS associated domain, notification plugin, secure store, dev client, WebBrowser, and image modules.
- Added .env.example, jest.config.cjs, eslint.config.js, package.json scripts, package-lock.json, and tsconfig Jest types.
- Added Jest tests for deep-link parsing/mapping, assistant event mapping, UUID generation, redaction, onboarding, and native empty/error states using React Native Testing Library.
- Added ID-based Maestro flow definitions under paydan-mobile/src/maestro for onboarding/auth, discovery, cart/checkout, assistant proposal, and order/wishlist navigation.
- Added stable testID coverage across auth, tabs, onboarding, catalogue, cart, checkout, account, product, and assistant proposal UI.
- Added accessibility labels to category, collection, sort, and product variant chips plus checkout address and save-address options.

## API contract and migration notes

All routes are versioned under /api/mobile/v1 and use the shared schemas. Account, cart, checkout, payment, order, sourcing, address, wishlist, assistant, and device responses are private no-store. Public catalogue and department reads use bounded shared caching.

Write mutations require UUID idempotency keys. Checkout quote is obtained by posting the same checkout payload with action set to quote; initialization then sends expectedTotal from that server quote. The client never supplies an authoritative total and never marks an order paid.

Payment status values are pending, paid, failed, and refunded. The mobile app verifies by reference after browser return, retries with bounded polling, and calls the reconcile endpoint once before polling. Order fields are fulfillmentStatus, items[].unitPrice, and timeline.

Database migrations 007_push_tokens.sql and 008_push_outbox.sql are additive and were not applied to any production database during this work. Apply them to staging first, verify the push worker/cron, then promote using the normal deployment process.

## Environment variables

Mobile public configuration (safe for the bundle):

- EXPO_PUBLIC_API_BASE_URL: required; the origin of paydan-next, for example https://paydan.store.
- EXPO_PUBLIC_APP_ENV, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID are permitted by the plan but are not currently consumed by the app code. Google public client IDs are not secrets.
- app.json extra.eas.projectId is public build metadata and is currently a placeholder; replace it with the real EAS project ID before push QA.

Server-only configuration (never EXPO_PUBLIC_*):

- DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BETTER_AUTH_TRUSTED_ORIGINS, MOBILE_APP_SCHEMES.
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
- PAYSTACK_SECRET_KEY.
- S3, CloudFront, MEDIA_CDN_URL, CLOUDFRONT_KEY_PAIR_ID, CLOUDFRONT_PRIVATE_KEY_BASE64.
- SMTP/Resend mail settings and webhook secrets.
- GROQ_API_KEY, OPENROUTER_API_KEY, and related direct assistant provider settings.
- EXPO_ACCESS_TOKEN for the server-side push outbox worker.

## Commands

Mobile setup and local checks, from paydan-mobile:

- Copy .env.example to .env and set EXPO_PUBLIC_API_BASE_URL.
- npm run typecheck
- npm run lint
- npm test
- npx expo config --type public
- npx expo start for Expo Go or a development build client.
- maestro test src/maestro once a development build is installed on a connected device or simulator.

Android development build:

- npx expo run:android with Android Studio installed, or
- npx eas-cli build --profile development --platform android

iOS development build requires Apple tooling and signing:

- npx expo run:ios on macOS with Xcode, or
- npx eas-cli build --profile development --platform ios

Release builds:

- npx eas-cli build --profile production --platform android
- npx eas-cli build --profile production --platform ios
- npx eas-cli submit after staged device QA and store metadata are ready.

Backend checks from paydan-next:

- npx tsc --noEmit
- npx vitest run
- npm run build

## External setup still required

- Google OAuth: register Android package store.paydan.mobile and iOS bundle store.paydan.mobile, configure the paydan callback scheme, and set server-side Google client ID/secret. Confirm the Better Auth Expo callback flow against the live staging origin.
- Android App Links: publish the assetlinks.json file at https://paydan.store/.well-known/assetlinks.json for the app signing certificate. The app.json intent filter is already present.
- iOS Universal Links: publish apple-app-site-association at https://paydan.store/.well-known/apple-app-site-association and confirm the associated domain entitlement in a signed build.
- Paystack: confirm the live secret key, register the webhook for /api/paystack/webhook, and keep MOBILE_APP_SCHEMES set to paydan://app,https://paydan.store so paydan://app/payment/callback is accepted. The server verifies reference, NGN amount, customer email, and order metadata.
- Expo/EAS: replace the placeholder project ID, configure Android FCM and iOS APNs credentials, set EXPO_ACCESS_TOKEN on the server, and schedule the push outbox worker with the existing cron jobs.
- Media: verify S3/CloudFront CORS and signed delivery for private sourcing and return images.
- Vercel: add the server-only variables listed above and run the additive migrations in staging before enabling mobile writes.

## Verification completed

- paydan-next TypeScript: passed.
- paydan-next Vitest: 86/86 tests passed across 3 files.
- paydan-next production build: passed with all mobile API routes included.
- paydan-mobile TypeScript: passed.
- paydan-mobile ESLint via expo lint: passed.
- paydan-mobile Jest: 18/18 tests passed across 7 files, including auth, cart, checkout, assistant proposal, onboarding, and common state component tests.
- Expo public config: loaded successfully for SDK 58.

## Explicitly untested

- Live buyer journeys against staging services with real accounts and real data.
- Physical Android and iOS devices, low/mid-range performance, and OS-level accessibility behavior.
- Expo Go runtime, Android development build installation, local native build, and EAS build/submit artifacts.
- Real Google OAuth sign-in, callback handling, and account switching on devices.
- Real Paystack success, cancel, failure, timeout, duplicate callback, app-killed recovery, and late webhook scenarios.
- Remote push receipt handling, APNs/FCM delivery, and notification deep-link navigation.
- Verified Android App Links and iOS Universal Links.
- Device-level end-to-end tests. ID-based Maestro flows were added but have not been executed on a device. Jest covers pure helpers, onboarding, common states, auth, cart, checkout, and assistant proposal confirmation; real device navigation and payment flows remain untested.
- Store submission, signed release builds, privacy metadata, and phased rollout.

## Security decisions

- No database, provider, Paystack, mail, AI, S3, or signing secret was added to the Expo app or any EXPO_PUBLIC_* variable.
- Mobile routes authenticate with the Better Auth session and revalidate viewer ownership on the server; web Origin validation remains in place for web routes.
- Guest catalogue responses omit prices and supplier fields; priced account responses are private no-store.
- Cart, checkout, sourcing, assistant proposal confirmation, and other consequential writes use UUID idempotency keys.
- Checkout totals, delivery, discounts, stock, payment verification, and order state remain server-authoritative.
- API errors use stable machine-readable codes and safe messages; the logger redacts cookies, tokens, prompts, signed URLs, and PII-bearing keys.
- Assistant mutations require explicit proposal confirmation. Chat history is in-memory, bounded, and reset when the account changes.
- No staff or admin capability was added to the mobile app.
- Deep links resolve only to supported buyer routes.

## Known limitations

- EAS projectId is still a placeholder, so Expo push tokens will not be scoped to the correct project until it is replaced.
- appEnvironment is derived from development/production build state rather than EXPO_PUBLIC_APP_ENV.
- First-run onboarding is shown once from the app entry using SecureStore; the native splash remains configured in app.json.
- Collection and safe sort filters are exposed in the native UI. Brand, availability, and price-band filters remain in the API contract but are not surfaced in the native UI.
- Payment return is handled by secure-browser dismissal plus reference verification. There is no dedicated in-app payment callback route screen.
- Next.js 16.4.4 emitted an npm security-advisory upgrade reminder during the production build. No dependency upgrade was performed as part of this work.

## Rollback

Both projects are separate Git repositories and all work is currently uncommitted. Before staging deployment, review the changes and create a commit in each repository. The clean rollback is then to revert the relevant commit in each repository and redeploy the previous revision.

If rollback is needed before committing, preserve copies of both working trees first, then restore only the tracked files changed for this work and remove only the new mobile/API files listed above. Do not run a broad git clean without first reviewing its dry run. Database migrations 007 and 008 are additive; do not drop their tables in production without a reviewed backup and restore plan.
