# PAYDAN React Native Build Prompt

You are completing the buyer-facing React Native version of PAYDAN. Work from the existing Next.js project and the companion plan in `PAYDAN_REACT_NATIVE_IMPLEMENTATION_PLAN.md`. The approved web desktop UX is the source of product behavior and visual direction, but the mobile application must feel native rather than like a compressed webpage.

## Project context

- Existing web/backend project: `paydan-next`.
- Create the mobile application as a separate sibling project/repository named `paydan-mobile`; do not add Expo dependencies to the Vercel web package.
- The Next.js application remains the backend, public web storefront and only admin/staff portal.
- PostgreSQL/Neon, private S3, CloudFront, Paystack, transactional email, Vercel AI Gateway and Groq already belong to the server architecture.
- Google is the only OAuth provider.
- Guests may browse but must not see prices. Purchasing starts after authentication.
- Ask PAYDAN is available globally and may search/explain products or propose cart changes, but a user must explicitly confirm every mutation.

## First action: audit before coding

Inspect the existing Next.js routes, Better Auth configuration, commands, domain services, catalogue DTOs, public/private cache controls, Paystack flow, CloudFront delivery, mail queue and assistant NDJSON/tool-result protocol. Produce a short gap list mapping each required mobile screen to an existing reusable service or a missing mobile API. Do not invent a parallel backend and do not replace working web behavior.

Read current official Expo and Better Auth Expo documentation before selecting package versions or auth configuration. Use the versions installed by the current stable Expo SDK and `npx expo install` where appropriate.

## Architecture to implement

1. Create a TypeScript Expo app with Expo Router and `expo-dev-client`.
2. Keep all server secrets in the Next.js/Vercel environment. Mobile may expose only the API base URL, app environment and platform Google public client IDs.
3. Add versioned Next.js endpoints under `/api/mobile/v1` that call existing domain services and return viewer-scoped DTOs.
4. Add a shared/generated contract package or schema export that contains DTO and error types only. Never import `src/server/*`, database code or secrets into the mobile bundle.
5. Add the official Better Auth Expo plugin on the server and client with SecureStore, while preserving existing browser authentication.
6. Use TanStack Query for remote state. Keep local state minimal and non-authoritative.
7. Use server-controlled Paystack initialization and verification. The app only opens the authorization flow and polls/refetches authoritative status.
8. Reuse the existing Ask PAYDAN endpoint, provider router, tools and proposal confirmation semantics.

## Required mobile API

Implement or adapt, with Zod validation, authorization, stable error codes, pagination and contract tests:

- bootstrap/session configuration;
- departments, catalogue, search and product detail;
- wishlist and recently viewed if server-backed;
- cart reads/mutations with idempotency keys;
- address and delivery options;
- checkout initialization and payment-status lookup/reconciliation;
- orders and order detail/tracking;
- sourcing requests and private media upload authorization;
- profile/account updates;
- assistant streaming and cart-proposal confirmation;
- push-token registration and removal.

Public catalogue endpoints may use bounded shared caching and ETags. Any response containing account, price, cart, order, address, payment or private-media data must be viewer-authorized and `private, no-store`.

## Required screens

Implement these native flows with loading, empty, offline, validation, retry and accessibility states:

- splash/onboarding;
- sign in, sign up, verify email, forgot/reset password and Google sign-in;
- guest home with no product prices;
- signed-in personalized dashboard;
- full department list, search/filter and product detail;
- wishlist and recently viewed;
- cart, address, delivery, checkout, payment pending/result/recovery;
- orders, tracking and sourcing;
- account/profile, notification preferences and sign-out;
- full-screen Ask PAYDAN with text, typed product results, tool status, proposal review and explicit confirmation.

Use five bottom tabs: Home/Dashboard, Departments, Ask PAYDAN, Cart and Account. Do not create a mobile admin interface.

## Authentication requirements

- Use the official Better Auth Expo client/server plugins and `expo-secure-store`.
- Implement email/password and Google only.
- Configure an app scheme and verified web links for OAuth, reset, payment return and order routes.
- Explicitly allow intended native origins/schemes on the server; do not turn off origin checking globally.
- Handle session bootstrap, expiry, revocation, sign-out, account switch and password-reset revocation.
- Keep Google client secrets on the server. Platform client IDs may be public Expo configuration.
- Add tests proving one user cannot read or mutate another user's data.

## Commerce and Paystack requirements

- Recalculate prices, discounts, delivery, stock and totals on the server for every checkout attempt.
- Initialize Paystack with the server secret and a server-generated reference.
- Open the authorization URL using an appropriate secure browser flow and return through a deep link.
- Treat the result as pending until the server verifies the exact reference, NGN amount, customer and metadata or processes an authenticated webhook.
- Make checkout initialization and callback/reload processing idempotent.
- Test cancellation, failure, timeout, duplicate callback, forged reference, app termination, late success and poor connectivity.
- Never include `PAYSTACK_SECRET_KEY` or authoritative totals in the app bundle.

## Media requirements

- Load public immutable product media from CloudFront.
- Request short-lived authorization for private sourcing/return uploads and downloads.
- Apply client-side size/type guidance, then repeat authoritative validation and secure processing on the server.
- Do not cache expired private signed URLs or reveal bucket keys unnecessarily.

## Ask PAYDAN requirements

- Parse the existing NDJSON stream and support cancellation through `AbortController`.
- Render text, catalogue products, auth-required responses, cart proposals and errors as typed native components.
- Never call Vercel Gateway or Groq directly from the device.
- Preserve guest/member price rules and server-derived identity.
- Require an explicit proposal review/confirmation call before a cart mutation.
- Do not replay a proposal when a stream fails or the app reconnects.
- Store only bounded, owner-partitioned local history and clear it on sign-out/account switch.

## Push and email

Email remains server-driven. Add Expo push tokens per authenticated user/device/environment and enqueue transaction notifications from the same durable events used by email. Cover payment confirmed/failed, order progress, sourcing quote ready, delivery and refund state. Remove invalid tokens from receipts, support opt-out for non-essential updates, and authorize every deep-linked destination.

## Design and accessibility

- Translate the PAYDAN palette, typography, spacing, radii and component hierarchy into a native token module.
- Recreate intent and hierarchy, not desktop CSS or DOM structure.
- Use safe areas, keyboard avoidance, 44-point minimum targets, accessible names/roles, dynamic text and useful screen-reader order.
- Use skeletons sparingly, preserve scroll position where expected and keep the active department/filter visible.
- Optimize images, list virtualization and render frequency for mid-range Android devices.

## Offline and error behavior

- Cache public catalogue/department reads and safe drafts.
- Refresh price, stock and delivery before cart confirmation/checkout.
- Never queue payment, checkout or other consequential writes offline.
- Retry only safe/idempotent operations with bounded exponential backoff and jitter.
- Provide distinct offline, server error, validation error, expired session, payment pending and maintenance states.

## Testing and QA

Add and run:

- TypeScript and lint checks;
- Jest unit tests for parsers, reducers, formatters and deep-link routing;
- React Native Testing Library coverage for auth, catalogue, cart, payment and assistant states;
- Next.js API contract and authorization tests;
- Maestro device flows for sign-in, discovery, cart, checkout return, order detail and Ask PAYDAN proposal confirmation;
- Android development-build QA on emulator and at least one physical low/mid-range device;
- poor-network, offline, background/foreground, app-killed and session-expiry checks.

Use Expo Go only for early compatible UI work. Move to an Expo development build before testing native auth, remote notifications, App/Universal Links or release behavior. Do not claim iOS-native validation passed unless it was run on an iOS device/simulator with the required Apple tooling.

## Security rules

- Do not print, copy, commit or move any existing secret file or environment value.
- Do not place a secret in an `EXPO_PUBLIC_*` variable.
- Validate every mobile request independently; navigation guards are not authorization.
- Redact tokens, cookies, prompts, provider bodies, signed URLs and PII from logs.
- Use opaque IDs and viewer-scoped queries; never accept a client-supplied customer ID as authority.
- Preserve CSRF/origin protections and add only the intended native scheme/origins.
- Keep financial writes idempotent and auditable.

## Delivery sequence

1. Audit and API gap report.
2. Contract schemas, versioned mobile routes and tests.
3. Expo foundation, navigation, theme and error handling.
4. Better Auth Expo integration and deep links.
5. Discovery/dashboard/product flows.
6. Cart, checkout, Paystack and orders.
7. Ask PAYDAN, sourcing and push notifications.
8. Accessibility, performance, poor-network and security hardening.
9. Staging pilot, signed release builds and store handoff.

After each phase, run the relevant checks and fix failures before continuing. Preserve unrelated uncommitted work. Do not commit, push, deploy, migrate production data or alter provider dashboards unless explicitly authorized.

## Required handoff

At completion provide:

- a file-level change summary for both projects;
- the mobile API contract and migration notes;
- environment variable names, clearly separating public mobile variables from server-only variables;
- commands for Expo Go, Android development build, tests and release builds;
- OAuth/deep-link, Paystack callback and push-notification dashboard setup still required;
- completed test results and explicit untested items;
- security decisions, known limitations and rollback steps.

The work is done only when buyer flows are functional with live staging services, no server secret exists in the app bundle, server authorization tests pass, payment state remains server-authoritative, Ask PAYDAN retains explicit confirmation controls, and the web storefront/admin still build and behave correctly.
