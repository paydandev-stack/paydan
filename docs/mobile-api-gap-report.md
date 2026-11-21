# PAYDAN Mobile API Gap Report (Phase 0 Audit)

Date: 2026-11-17. Source: `paydan-next` codebase. Target: buyer-only Expo app `paydan-mobile`.

## Reusable as-is (server domain services)

| Mobile need | Existing server capability | Notes |
|---|---|---|
| Guest/member catalogue DTOs with price privacy | `src/lib/catalog-dto.ts` (`toPublicProduct(s)`, `toMemberProduct(s)`, `toViewerProducts`, `pricesVisible`) | Field-allowlist DTOs; costPrice/vendorId never leak. Reuse directly. |
| Paginated catalogue search/filter | `GET /api/products` (`src/app/api/products/route.ts`) | Cursor pagination, brand/availability/price-band/collection/sort filters, guest price-sort guard. Needs mobile route wrapper with stable error codes. |
| Product detail + related | `GET /api/products/[slug]` | Viewer-scoped projection, public cache headers for guests. Reuse query. |
| Public price-free snapshot | `GET /api/catalog` + `src/server/public-catalog.ts` | 300s shared cache, `public, max-age=60, s-maxage=300` headers. Reuse for bootstrap. |
| Personalized snapshot (cart, wishlist, addresses, orders, sourcing, notifications) | `GET /api/store` + `src/server/snapshot.ts` | `private, no-store`, viewer-scoped, test-buyer partitioning. Reuse `snapshot()` + `customerOrder`/`customerRequest` projections. |
| Idempotent cart/address/wishlist/location mutations | `POST /api/commands` + `command()` in `src/server/commands.ts` | `command_receipt` idempotency keyed by `(owner_id, key)`; per-account advisory lock; 100-line cart cap. Reuse `command()` directly. |
| Checkout quote/initialize/verify/resume | `POST /api/checkout` + `src/server/payments.ts` | Server recalculates totals, reserves stock, Paystack server-secret init, `expectedTotal` mismatch guard, pending-payment guard, idempotent `checkout:{key}` receipt. Reuse `quoteCart/initialize/verifyPayment/resumePayment`. |
| Paystack webhook verification | `POST /api/paystack/webhook` + `validSignature()` | HMAC-SHA512 verification. No mobile change needed. |
| Ask PAYDAN streaming + proposal confirm | `POST /api/assistant` (NDJSON `text-delta/tool-result/reply/done/error`) + `POST /api/assistant/proposals/confirm` | Gateway-primary/fallback router, 15-min proposal expiry, owner-scoped confirm via `command(addToCart)`. Reuse `chatResponse`/`confirmAssistantProposal`. |
| Sourcing submit/respond | `command(submitSourcing/respondToQuote)` + `src/server/schemas.ts#sourcing` | Owner-scoped media check, viewer notifications enqueued. Reuse. |
| Support threads | `GET/POST /api/support` | Owner-scoped threads. Reuse or expose via mobile route. |
| Notifications list/mark-read | `GET/POST /api/notifications` | Owner-scoped. Reuse. |
| Media upload auth (sourcing/return) | `POST /api/media` (`beginUpload`/`finalizeUpload`) | Presigned POST, 5MB mime allowlist, server re-encode via sharp. Reuse. |
| Auth (email/password + Google, sessions, reset revocation) | `src/server/auth.ts` (better-auth 1.7.17) + `src/server/http.ts#viewer` | `revokeSessionsOnPasswordReset: true`, email verification required. **Missing: Expo plugin** (`@better-auth/expo` not installed; `better-auth/expo` subpath not exported in 1.7.17). |
| Origin/CSRF protection | `sameOrigin()` + `src/server/origins.ts` allowlist | Must extend allowlist with app scheme + applinks, not disable. |
| Rate limiting | `limit()` in `src/server/http.ts` | Reuse per-endpoint buckets. |

## Missing — must build

1. **Versioned mobile routes** `src/app/api/mobile/v1/*`: bootstrap, catalog, departments, products/:id, search, cart, checkout/initialize, payments/:reference, payments/:reference/reconcile, orders, orders/:id, sourcing, profile, addresses, wishlist, assistant, assistant/proposals/:id/confirm, devices/push-token. Thin wrappers calling the services above with Zod validation, cursor pagination, stable machine-readable error codes (`{ code, message }`), and correct cache headers.
2. **Shared contract package** (`packages/mobile-contract` or `src/mobile-contract/`): DTO + error-code Zod schemas and TypeScript types only. No server imports. Consumed by both Next.js routes and the Expo app (via file copy or workspace link — separate repo, so publish or vendor it).
3. **Better Auth Expo integration**: install `@better-auth/expo` (client, in `paydan-mobile`) + `expo-secure-store`; server side add `expo()` plugin from `better-auth/expo` (requires upgrading/adding the expo server plugin package — verify against official docs at implementation time). Preserve browser behavior.
4. **Push-token storage + fan-out**: new `push_token` table (user/device/environment/token) + migration; enqueue Expo push sends from the same durable events used for email (payment confirmed/failed, order progress, sourcing quote ready, delivery, refund). Remove invalid tokens from receipts.
5. **Mobile deep-link config**: app scheme (`paydan://`) + Android App Links + iOS Universal Links; `callback_url` for Paystack resume must support the app return link; auth/OAuth callbacks.
6. **Expo app `paydan-mobile`** (separate repo): Expo Router, theme tokens, TanStack Query client, SecureStore session, 5-tab shell, all screens/flows per plan, Maestro flows, Jest/RNTL coverage.
7. **Contract + authorization tests**: PGlite-backed tests proving viewer isolation (user A cannot read/mutate user B data), guest price invisibility, idempotency-key replay, forged payment reference rejection.
8. **Paystack mobile return URL**: `resumePayment`/`initialize` currently hardcode `${BETTER_AUTH_URL}/checkout/success` as `callback_url`. Mobile needs a per-request return URL (web success page that deep-links to the app, or direct applink) — server must validate it against the allowlist.

## Decisions / constraints confirmed from code

- `sameOrigin()` rejects requests without a trusted `Origin` — native apps don't send web origins; mobile routes need bearer/session-token auth (Better Auth Expo bearer or cookie) instead of origin checks. Keep `sameOrigin` on web routes.
- `viewer()` requires `emailVerified` — mobile auth must complete verification before priced data.
- Test-buyer partitioning (`isTestBuyer`, `test*` record kinds) must be preserved in mobile routes via the same helpers.
- Checkout `expectedTotal` anti-tamper check stays server-side; mobile sends it from the quoted total.
- Assistant proposals expire after 15 min, single `add_to_cart` action, owner-scoped — mobile confirm endpoint reuses `confirmAssistantProposal` unchanged.
- No admin/staff logic goes mobile; `snapshot(user, admin=false)` path only.
