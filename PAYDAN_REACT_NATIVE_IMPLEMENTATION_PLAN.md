# PAYDAN React Native Implementation Plan

## 1. Objective

Build a buyer-only PAYDAN mobile application for Android and iOS with React Native and Expo. The existing Next.js application remains the system of record and the only staff/admin portal. The mobile app must reuse PAYDAN's live catalogue, authentication, cart, checkout, orders, sourcing, notifications and Ask PAYDAN capabilities without duplicating business rules or exposing server secrets.

Target delivery for a production-ready first release is approximately 6–10 weeks after the mobile API contract and designs are approved.

## 2. Non-negotiable boundaries

- Do not port `/admin` or staff operations to mobile.
- Keep Neon, S3/CloudFront, Paystack, Resend/SMTP, direct Groq/OpenRouter and all signing credentials on the Next.js server.
- Never put a database URL, provider secret, S3 credential, Paystack secret or AI key in Expo variables or the app bundle.
- Treat the mobile app as an untrusted API client. Revalidate authentication, ownership, prices, inventory, totals, delivery and permissions on the server.
- Preserve the approved desktop/web experience. Mobile API work must not break browser sessions or web routes.
- Use a separate `paydan-mobile` project/repository. This keeps Expo native dependencies out of the Vercel web build while allowing a shared generated API contract later.

## 3. Recommended stack

- Current stable Expo SDK with TypeScript and Expo Router.
- React Native core primitives plus the existing PAYDAN design tokens translated into a small native theme.
- Better Auth's official Expo server/client integration with `expo-secure-store` for native session storage. See [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo).
- TanStack Query for server state, retry control, cache invalidation and offline-aware reads.
- A small local store only for transient UI state such as draft filters, assistant visibility and checkout step—not authoritative commerce data.
- `expo-secure-store` for session material; AsyncStorage only for non-sensitive preferences and carefully versioned drafts.
- `expo-notifications` for transaction-status notifications.
- Jest, React Native Testing Library and Maestro for unit, component and end-to-end coverage.

Expo Go is useful for early layout work, but production features should be tested with an Expo development build because Expo Go has fixed native libraries and cannot fully test remote notifications or App/Universal Links. See [Expo development build guidance](https://docs.expo.dev/develop/development-builds/faq/).

## 4. System architecture

```text
Expo buyer app
  -> HTTPS /api/mobile/v1/* on the Next.js deployment
      -> Better Auth session and viewer-scoped authorization
      -> PAYDAN domain services and PostgreSQL
      -> S3 uploads / CloudFront media URLs
      -> Paystack initialization and server verification
      -> mail and notification jobs
      -> Ask PAYDAN controlled tools and provider router

Web storefront and web admin
  -> continue using their existing routes and services
```

The mobile routes should call the same domain services already used by the web app. Do not copy totals, price visibility, stock reservation, fulfilment, refund, assistant tool or role logic into React Native.

## 5. Mobile API contract

Create a versioned contract under `/api/mobile/v1` and return small, viewer-scoped DTOs. Suggested endpoints:

- `GET /bootstrap`: feature flags, current viewer summary and app configuration.
- `GET /catalog`, `GET /departments`, `GET /products/:id`, `GET /search`.
- `GET/POST/PATCH/DELETE /cart` using idempotency keys for writes.
- `POST /checkout/initialize`, `GET /payments/:reference`, `POST /payments/:reference/reconcile`.
- `GET /orders`, `GET /orders/:id`, `GET/POST /sourcing`.
- `GET/PATCH /profile`, `GET/POST/DELETE /addresses`, `GET/POST/DELETE /wishlist`.
- `POST /assistant`, `POST /assistant/proposals/:id/confirm` using the existing NDJSON/tool-result contract.
- `POST/DELETE /devices/push-token` for notification registration.

Requirements:

- Generate or share TypeScript DTO schemas from one contract source; never import Next.js server modules into the mobile bundle.
- Support cursor pagination for catalogue, search and orders.
- Return stable machine-readable error codes plus safe display messages.
- Use `Cache-Control` and ETags for public catalogue reads; keep customer/account responses `private, no-store`.
- Require idempotency keys for cart confirmation, checkout initialization and other consequential mobile mutations.
- Add API contract tests before building screens against an endpoint.

## 6. Authentication and deep links

1. Add the official Better Auth Expo plugin to the existing server without changing web behavior.
2. Configure the Expo client plugin and SecureStore using the same cookie prefix as the web server.
3. Implement email/password sign-in, sign-up, verification, reset and sign-out.
4. Implement Google sign-in through the Better Auth Expo flow and register separate Android and iOS Google OAuth clients where required.
5. Configure a PAYDAN app scheme plus verified Android App Links and iOS Universal Links for OAuth callbacks, password reset, payment return and order links.
6. Add mobile origins/schemes to the explicit server allowlist; do not disable origin validation globally.
7. Revoke native sessions after password reset, account suspension and explicit sign-out.
8. Test expired, revoked, duplicated and cross-account sessions.

Only these values may be public mobile configuration:

```env
EXPO_PUBLIC_API_URL=https://paydan.store
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Public Google client IDs identify the OAuth app and are not client secrets. All remaining credentials stay on the Next.js/Vercel server.

## 7. Screen and navigation map

Use a five-item buyer tab shell consistent with the approved web flow:

1. Home/Dashboard.
2. Departments.
3. Ask PAYDAN.
4. Cart with quantity badge.
5. Account.

Required flows:

- Splash and lightweight onboarding.
- Sign in, sign up, email verification, reset password and Google sign-in.
- Guest home with price-free product discovery.
- Signed-in dashboard with personalized content and full department list.
- Department, search/filter, product detail, wishlist and recently viewed.
- Cart, address, delivery, Paystack handoff, payment pending/result and recovery.
- Orders, order detail/tracking, sourcing requests and account settings.
- Full-screen Ask PAYDAN with typed results, explicit proposal confirmation and resilient streaming states.

Use native interaction patterns: safe areas, keyboard avoidance, 44-point minimum targets, accessible labels, dynamic text, clear loading/empty/error states and no hover-dependent actions.

## 8. Payments

- The app requests checkout initialization from PAYDAN's server.
- The server recalculates totals, reserves stock and initializes Paystack using its secret key.
- The app opens the returned authorization URL in a secure browser session and handles the configured return link.
- The app displays `pending` until the server verifies Paystack by reference or receives an authenticated webhook.
- The client never supplies the authoritative total and never marks an order paid.
- Repeated callbacks and refreshes must be idempotent.
- Test success, cancel, failure, slow/pending, duplicate return, forged reference and app termination mid-payment.

Paystack requires verification from the server after a mobile/redirect flow. See [Paystack payment verification](https://paystack.com/docs/payments/verify-payments/).

## 9. Media and uploads

- Render published product media from stable CloudFront URLs with responsive dimensions and placeholders.
- Ask the server for short-lived upload authorization for sourcing/return images.
- Validate size/type on device for UX, then repeat authoritative validation, re-encoding and metadata stripping on the server.
- Keep private evidence behind viewer authorization and short-lived signed delivery URLs.
- Cache public catalogue images aggressively; do not persist private signed URLs beyond their lifetime.

## 10. Ask PAYDAN

- Reuse the implemented server router: Gateway primary/fallback, transient-only direct Groq, deterministic fallback.
- Stream the existing NDJSON response and render text, product results, auth requirements, cart proposals and errors as typed components.
- Stop the request when the screen unmounts or the user cancels.
- Never run AI providers or expose provider keys in the app.
- Require explicit confirmation before calling the existing cart-proposal confirmation endpoint.
- Keep chat history local and owner-partitioned for the first release; clear it on account changes and provide a user-visible clear action.

## 11. Transaction updates

- Continue sending transactional email from the server.
- Store Expo push tokens by authenticated user, device and app environment.
- Enqueue push jobs from the same durable domain events used for email: payment confirmed/failed, order accepted, sourcing quote ready, fulfilment progress, delivery and refund state.
- Remove invalid tokens from provider receipts and let users disable non-essential notifications.
- Deep-link a notification only to a viewer-authorized route.

Remote push notifications need a development build rather than Expo Go. Expo supports a unified notification API for Expo Push, FCM and APNs; see [Expo notifications](https://docs.expo.dev/guides/using-push-notifications-services/).

## 12. Poor-network and offline behavior

- Cache public catalogue and department reads for fast repeat visits.
- Show the age of cached price/availability data and refresh before cart/checkout.
- Keep safe local drafts for sourcing text and unsent support messages.
- Do not queue checkout, payment, cart confirmation or other consequential writes while offline.
- Use bounded retries with jitter for idempotent reads only.
- Provide explicit retry, reconnect and session-expired states.

## 13. Free development and QA workflow

- Early UI: Expo Go on physical Android/iOS where supported.
- Full free Android QA: `expo-dev-client`, Android Studio Emulator and one or more physical Android devices using `npx expo run:android`.
- Automated checks: TypeScript, ESLint, Jest, React Native Testing Library and locally run Maestro flows.
- Network/error QA: Android emulator network controls, offline mode and a local mock server.
- iOS layout/basic behavior: Expo Go on a physical device where compatible. Full native iOS signing, push, Universal Links and store distribution require Apple tooling/account access.
- Produce a release build and test on representative low/mid-range Android devices before Play submission.

Expo documents local Android development builds with Android Studio and `npx expo run:android`; see [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## 14. Delivery phases

### Phase 0 — Audit and contract

- Inventory current buyer routes, commands, DTOs and missing mobile-safe endpoints.
- Freeze v1 navigation, design tokens, analytics events and API error format.
- Add API contract tests and a staging environment.

### Phase 1 — Foundation and auth

- Create the Expo project, routing, theme, error boundary, logging redaction and API client.
- Add Better Auth Expo integration, SecureStore, email/password and Google OAuth.
- Configure development deep links.

### Phase 2 — Discovery

- Build guest/member home, dashboard, departments, search, product detail and wishlist.
- Add pagination, public caching, CloudFront images and empty/error states.

### Phase 3 — Commerce

- Implement cart, address, delivery, checkout, Paystack handoff, order history and tracking.
- Add idempotency, recovery states and end-to-end test fixtures.

### Phase 4 — Assistant, sourcing and notifications

- Add Ask PAYDAN streaming/tool UI, cart proposal review, sourcing and push registration.
- Connect durable transaction events to push while retaining email.

### Phase 5 — Hardening and release

- Accessibility, poor-network, device-size, battery/performance and security testing.
- Staging pilot, privacy/store metadata, screenshots, signed builds and phased rollout.

## 15. Definition of done

- Buyer journeys work on supported Android and iOS targets; admin remains web-only.
- Guest prices remain hidden and signed-in data is isolated by server session.
- No production secret is present in the mobile bundle, logs or repository.
- Checkout totals and payment state are server-authoritative and idempotent.
- Ask PAYDAN preserves the same tool permissions and explicit confirmation model as web.
- Deep links, OAuth callbacks, payment recovery and push notification navigation are tested.
- Core flows have unit, contract, component and device-level end-to-end coverage.
- Production crash/error reporting is privacy-safe, release rollback is documented, and store builds pass final device QA.
