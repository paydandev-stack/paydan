# Claude implementation prompt — PAYDAN UI/UX and production build

> Implementation update — 6 November 2026: PostgreSQL, AWS S3, Google-only OAuth and Paystack are implemented in this application. AI is provider-configurable but intentionally unconfigured. Read `docs/CONTEXT_AND_HANDOFF.md`, `docs/implementation-progress.md`, `docs/USER_FLOW_REVIEW.md` and `SETUP_AND_OPERATIONS.md` for the linked history, delivered scope, validation and required external setup. The specification below is a target, not proof that live integrations have been tested.


Copy the prompt below into Claude with access to the existing project. It is self-contained; the companion `PAYDAN_Consolidated_Plan.md` provides a readable product plan. Resolve references relative to the actual checkout if the project moves. Keep this document available throughout implementation.

---

You are the lead product designer and full-stack engineer completing the existing PAYDAN application. Implement the work in this prompt; do not stop after giving a plan, a homepage, a mock dashboard, or a simulated checkout.

## A. Existing project and working rules

Primary app: `C:\Users\PRAISE\Desktop\paydan\paydan\paydan-next`.

Parent folder contains the legacy Figma/Vite export and product briefs. Work in the Next.js app, not the old Vite scaffold. Read applicable `AGENTS.md` and `CLAUDE.md`, then inspect the current source and Git state. The app's `AGENTS.md` requires consulting relevant installed Next.js guides in `node_modules/next/dist/docs/` before writing code. Verify actual package versions and library compatibility; do not upgrade everything speculatively.

Useful starting points:

- `src/app/(storefront)/page.tsx`, `login/page.tsx`, `register/page.tsx`, `account/page.tsx`, `account/layout.tsx`, `checkout/page.tsx`.
- `src/components/product-card.tsx`, `catalog/catalog-view.tsx`, `storefront/site-header.tsx`, `storefront/mobile-tab-bar.tsx`.
- `src/lib/store.tsx`, `src/lib/types.ts`, `src/data/seed.ts`, other data fixtures, and `src/styles/*`.
- Parent `PAYDAN_MASTER_PROMPT.md` and `PAYDAN_EXPANSION_PROMPT.md` for missing internal operations scope. The newer instructions in this prompt override conflicting old UX requirements.

Prior inspection found a broad customer storefront, demo accounts, browser-local state, sample supplier/order data, and no admin route pages in the Next.js app. Login accepts arbitrary passwords. Verify the current state rather than assuming nothing changed.

The client loves the homepage. Capture its desktop/mobile baseline before edits. Preserve existing composition, brand, department ordering, and approved visual character. Reuse and extend components. Do not overwrite unrelated work, rewrite the whole project, remove existing features, or silently change category publication decisions.

Proceed in phases and maintain `docs/implementation-progress.md` with completed items, remaining work, tests, assumptions, and configuration blockers. Keep changes reviewable. If context runs out, leave an exact continuation point rather than claiming completion. Missing service credentials only block their dependent live verification; continue all independent work. Do not provision paid infrastructure or deploy publicly as an incidental part of coding.

## B. Product rules — mandatory

PAYDAN is a Nigerian admin-operated retailer/procurement business with multiple internal suppliers and one customer-facing store. No vendor self-registration, public vendor portal, or automated supplier payouts in this release.

1. Preserve the public homepage design, with targeted pricing/CTA/motion/chat changes.
2. Homepage product listings never show prices, even to signed-in users.
3. Anonymous users never receive catalogue prices anywhere: page, search, product detail, public API, AI response, structured metadata, client fixture, or prefetch payload.
4. Show public imagery, names, descriptions, specifications, approved availability, departments, and collections. Use sign-in-to-shop/view-price actions. Remove public monetary promotions and indirect price hints such as discount percentages and price filters.
5. Purchases and persisted cart mutations require authentication. Guests may maintain an unpriced pending selection; it is not an actual order or priced cart.
6. Sign-in leads to a personalized shopping dashboard and preserves the shopper's pending product, variant, quantity, department, search, or conversation.
7. Members can browse departments/products and shop at current prices inside their member experience.
8. Email/password and OAuth both work. Use Google as the proposed first OAuth provider unless project configuration identifies another choice.
9. A chat launcher is available on every application-owned page, including authentication, catalogue, dashboard, checkout, support, and admin layouts. On admin pages it remains the retail assistant; do not grant internal tools based on staff status. External payment/provider pages are outside app control.
10. AI tools enforce anonymous versus authenticated permissions on the server. Customer AI never exposes supplier contacts, cost prices, margins, staff notes, or other customers' data.
11. Paystack is the client-confirmed payment provider. Implement its integration; do not substitute another gateway based on convenience or old configuration.

## C. Complete the UI/UX first

### Public storefront

Retain homepage layout, product imagery, department navigation, cards, and merchandising. Replace price blocks with appropriate actions while keeping card heights balanced. Signed-in visitors see an obvious dashboard entry point. Guest search and filters omit price facets. Products/collections must have useful empty and unavailable states.

### Authentication

Reference `https://nexarhq.com` and `https://app.nexarhq.com` for the public-to-app handoff and split auth composition. Adapt using PAYDAN's green/orange identity and product imagery, not Nexar's branding. Do not claim access to Nexar's authenticated dashboard.

Use a deep-green visual/story panel on desktop, a clear light form area, and a compact mobile presentation. Include provider-labelled OAuth button, separator, email/password, show password, recovery, verification, and helpful errors. Registration: name, email, password, terms acknowledgment; collect shipping details later. Handle OAuth cancellation, provider errors, duplicate-account/linking cases, verification expiry, and resend cooldowns. Do not expose demo credentials in production.

Use a validated internal continuation identifier; no open redirects. Save only minimal pending intent. After authentication, land at `/dashboard` and present the item or resume chat. Never replay a purchase automatically. Revalidate/merge selections once, including duplicate-SKU quantities, unavailable variants, and maximum limits.

### Member shell and dashboard

Implement `/dashboard` as the member home; redirect `/account` there while preserving existing `/account/*` links. Reuse catalogue routes/components with explicit public/member data boundaries. Do not create competing versions of the catalogue or cart.

Desktop: compact sidebar, prominent search, location, cart, notifications, profile. Main area: greeting, pending-intent/resume card, departments, priced product collections, relevant order/quote updates, buy-again/saved items, sourcing shortcut, AI prompt. Give most space to products rather than account metrics.

Mobile: Home, Departments, Cart, Orders, Account navigation; clear thumb-friendly actions, safe-area spacing, accessible filters. First-time users get neutral collections and optional preferences; returning users get factual history-based personalization. Expose full profile/address/order/return/quote flows through the member shell.

### Global assistant interface

“Ask PAYDAN” launcher opens a generous desktop panel with expand/minimize/close, and full-screen mobile chat. Mount it persistently across layout transitions, maintain conversation when navigating, and do not auto-open repeatedly. Position it away from sticky CTAs, navigation, keyboard, and checkout fields. Use accessible dialog behavior, focus return, labelled controls, keyboard escape, and restrained streaming announcements.

Provide starters, plain text, compact product cards, collection links, comparison results, variant/quantity selection, updated cart summary, undo, loading, timeout, retry, and human-support fallback. Mark it as AI. Retrying must not duplicate a completed mutation. Anonymous chat can maintain an unpriced draft and hand off to authentication. Member chat resumes with verified access. Keep private history inaccessible after logout or account switching.

### Motion

Use once-only 8–12px section reveals, subtle card feedback, roughly 150–250ms control transitions and 300–450ms panel transitions. Preserve the approved homepage rather than re-skinning it. Avoid distracting loops, scroll hijacking, animated form reflow, or fake activity notifications. Honor reduced motion; content stays usable if animation does not run.

### Complete supporting journeys

Finish catalogue/search, variants, wishlist, cart, addresses, checkout, order confirmation/history/detail, supplier-group tracking, sourcing request/detail, quote review/acceptance, returns, support, profile, and notifications. Each visible control must lead somewhere meaningful. Provide loading/empty/error/success states, form validation, back navigation, and session-expiry recovery.

Do not present policy drafts as approved terms. Implement configurable policy content and mark business approval as a release prerequisite. Preserve current explicit category visibility choices; do not republish restricted departments as part of this work.

UI work may use isolated development adapters, but public development views must still use price-free DTOs. Never leave a client-side full catalogue/supplier seed as the final production data architecture.

## D. Production foundation: Next.js and external database

The external DB and S3 bucket are confirmed requirements. Database provider/engine, S3 endpoint, OAuth credentials, AI provider/model, email provider, deployment host, and production URLs may not yet be configured.

Inspect existing configuration without printing secrets. Prefer existing compatible choices. If no DB engine is specified, document external PostgreSQL as a provisional choice and use one maintained compatible ORM/query layer with versioned migrations. Do not pretend that provider selection is final. Ask one focused configuration question only when a missing choice blocks further dependent work.

Use Next.js server-only services and a data-access layer. Server Components read authorized data; Client Components own interaction. Authenticate/authorize every Route Handler, Server Action, AI tool, and download/upload operation independently. Route gating is supplementary. Validate input and enforce record ownership and staff roles close to data access.

Define distinct public product, member product, member order, and admin record DTOs. Build objects from allowlisted fields; do not spread ORM rows into client props. The demo's `Product` and `OrderItem` include `costPrice`, and demo state imports vendors: these must never reach customer bundles/payloads. Public code must not import fixtures carrying private fields. Do not rely on hiding rendered text.

Protect private responses and caches across sessions. Public pages may be cached only when data is public. Audit HTML, RSC/Flight serialization, route prefetch, JavaScript output, JSON-LD, logs, and search/AI results for leakage. Authenticated chat may show prices on the public homepage, but homepage cards remain price-free.

Model at least: users, auth identities/sessions/tokens, roles; addresses; departments/categories/collections; products, variants, inventory/availability and media; suppliers and product sourcing relationships; carts/lines, wishlists; orders, immutable item/address/price snapshots, supplier sub-orders, shipment events; payment attempts/provider events/refunds; sourcing requests, versioned quotes/lines/acceptance; returns; promotions/content/settings; conversations/messages/tool-action receipts; notifications/outbox; audit events.

Use integer kobo amounts and NGN formatting at display boundaries. Migrate demo whole-naira values explicitly. Add ownership foreign keys, required uniqueness, useful indexes, validation constraints, transactional updates, and pagination. Preserve historical snapshots when products, addresses, or prices change. Use an explicit availability/reservation policy and race-safe updates where stock quantities are tracked.

Create schema, migrations, development seeds, and documented migration commands. Do not seed production with fictional orders/customers or reset an existing external DB. Use development/test targets for integration work; review destructive migration steps separately. Configure TLS/pooling appropriate to the actual DB and hosting environment.

## E. Real authentication and permissions

Choose a maintained authentication solution compatible with the installed Next.js version and supporting the chosen DB, email/password, and OAuth. Implement secure password hashing, verified email, expiring single-use reset tokens, safe sessions, rate limits, and non-enumerating recovery errors. Follow the library's CSRF/state/nonce/PKCE mechanisms rather than hand-rolling OAuth.

Support safe identity linking. Never enable permissive same-email account linking just to bypass an error; prove ownership according to the selected library/provider. Sessions and user roles are server-authoritative. Implement revocation/logout and prevent users editing their own role. No browser storage token may confer admin access.

Create a safe initial-admin bootstrap mechanism, with role-based catalogue/procurement/support/admin access and no public admin signup. Do not include fixed production admin credentials. Test anonymous, customer A, customer B, and restricted staff roles separately.

## F. S3 storage

Configure AWS S3 or the supplied compatible endpoint, region, bucket, credentials or workload identity, and optional public media origin. Keep secrets server-only. Separate public catalogue assets from private customer attachments using suitable buckets/prefixes and access policies; never make all objects public for convenience.

Implement authorized short-lived direct upload flows with server-generated unique keys. Allowlist types and sizes, validate ownership, and verify the uploaded object's actual size/type/content before marking it usable. Use upload policies that enforce limits where supported; quarantine or reject invalid objects. Avoid active-content/SVG risks unless explicitly sanitized. Product publishing must not expose unvalidated assets.

Store keys and metadata in the DB, not expiring signed URLs. Authorize each private read and issue a short-lived download URL. Ensure one user cannot request another user's attachment by changing an ID/key. Apply restricted CORS and least-privilege permissions. Add progress/retry/error UI, deletion rules, and orphan cleanup. Document that presigned URLs are bearer access and may be reusable until expiry; do not describe them as inherently single-use.

## G. Commerce, payment, and internal operations

Both UI and AI must call the same cart and order services. Recalculate prices, discounts, quantities, delivery, and totals server-side. Reject client-supplied totals. Make repeated submissions safe with idempotency and transactional order creation. Preserve carts across sessions/devices.

Paystack is the confirmed payment provider. After the PAYDAN order-review step, use Paystack's supported payment interface and return to PAYDAN's confirmation or pending-payment view. Offer only channels supported and enabled for the merchant account. Do not implement a separate manual bank-transfer payment route unless explicitly requested; bank transfer offered within Paystack remains a Paystack payment. Supplier sub-orders do not imply split payments or automated supplier payouts.

Initialize payment server-side with a unique reference and server-calculated NGN amount in integer kobo. Verify Paystack success, expected amount/currency/reference, and correct order before marking paid. Validate webhook authenticity using the current official procedure and raw-body requirements. Deduplicate webhook/callback handling and avoid duplicate fulfilment. Handle cancelled, failed, pending, late, reversed/refunded, and duplicate events with valid state transitions and reconciliation.

Document Paystack test/live credentials, callback URL, webhook endpoint, and account channel configuration. Keep secret keys server-only; expose a Paystack public key only if required by the chosen official frontend integration. Implement and verify in test mode before live activation. Test successful checkout, cancellation, failure, pending/retry, forged callbacks, invalid webhook signatures, and duplicate/late notifications. If credentials are unavailable, finish the integration and automated contract tests, then report external Paystack tests as blocked rather than passed. Refund actions require authorized staff access and provider-status reconciliation; never claim a refund completed from a local toggle alone.

Never mark paid from a client redirect or AI statement. Pending payment gets a real pending view, not a success claim. Keep payment status distinct from procurement/fulfilment. The AI can prepare the cart and open checkout; it cannot collect card credentials or silently submit payment.

For supplier-confirmed/preorder items, use an availability-confirmation/quote step before charging unless a different policy is explicitly approved. Explain mixed baskets and any separate confirmation-required items. Do not invent delivery fees, ETAs, return windows, or refund commitments. Make them configurable and identify unapproved policy as a launch blocker.

Build the missing internal UI and server operations: product/variant/media/category management, supplier directory, orders and supplier sub-orders, procurement stages, sourcing/quotation workflows, customer support view, promotions/content, returns/refund review, settings, staff roles, and audit history. Avoid unrestricted client toggles that forge payment status. Keep reporting based on real persisted records. Supply a manual fulfilment-update workflow if no courier integration exists; label it honestly.

Quotes need validity, immutable accepted terms, ownership, and deduplicated conversion to orders. Returns require review and status history; submitted does not mean approved/refunded. Add transactional email for verification/recovery and appropriate order/quote/support events using durable retryable jobs/outbox. Provide a documented scheduler/worker mechanism for the deployment target; do not rely on unawaited background promises in a serverless request.

## H. AI server implementation

Implement a provider-neutral server adapter with three explicit provider slots and a final non-AI fallback. Production uses Vercel AI Gateway with `AI_MODEL_PRIMARY` (initial candidate `anthropic/claude-haiku-5.5`) followed once by `AI_MODEL_SECONDARY` (initial candidate `openai/gpt-6-luna`). Development and Vercel Preview may use a separate direct Groq adapter with `openai/gpt-oss-20b` and a Groq free-plan key. The default test profile is Groq-only so testing does not silently consume Gateway credits; an explicit test-only `last` mode may exercise primary -> secondary -> Groq failover. Production must reject/ignore the Groq test adapter in code even if stale environment variables enable it. If all permitted providers fail, return deterministic normal search, catalogue and support links instead of fabricated AI output.

Use `AI_ENABLED`, `AI_ROUTING_PROFILE`, `AI_GATEWAY_API_KEY`, `AI_MODEL_PRIMARY`, `AI_MODEL_SECONDARY`, `AI_PROVIDER_TIMEOUT_MS`, `AI_TOTAL_TIMEOUT_MS`, `AI_TEST_GROQ_ENABLED`, `AI_TEST_GROQ_MODE`, `AI_GROQ_BASE_URL`, `AI_GROQ_API_KEY` and `AI_GROQ_MODEL`. Keep every credential server-only. Do not require direct Anthropic/OpenAI keys while Gateway-managed credentials are used. Keep the legacy `AI_CHAT_COMPLETIONS_URL`, `AI_API_KEY` and `AI_MODEL` reads only until the new adapter and deployment migration pass; remove them in a follow-up cleanup.

Fail over only for transient timeouts, network failures, rate limits and provider 5xx errors. Authentication, invalid requests, safety/authorization failures, schema failures and application-tool errors fail closed. Never replay a write tool or confirmed cart mutation because a provider stream failed. Use synthetic accounts/orders when exercising the free Groq profile. Implement a real streamed endpoint with bounded history/context, rate limits, per-provider and total timeouts, spend limits, provider/model telemetry and failure handling. A deterministic fixture assistant may exist only as clearly labelled development/test tooling.

Anonymous tools: search published price-free catalogue, explain a product/collection, retrieve approved policies, build an unpriced draft. Do not give the anonymous model prices and merely tell it not to repeat them.

Member tools: search priced catalogue, compare products, read own cart, add/update/remove lines, read own orders/quotes, and prepare/submit sourcing requests after user review. Every call rechecks the live session and resource ownership. Customer identifiers come from session context, never model assertions. Do not give raw SQL, arbitrary network, unrestricted file, staff-management, or payment-execution tools to the assistant.

Treat catalogue text, messages, attachments, and retrieved documents as untrusted content. Use schema-validated tool inputs and narrow permissions. Resolve SKU/variant/quantity ambiguity before mutation. Require explicit user intent for changes; proposed baskets remain proposals until selected. Tool-action IDs prevent duplicate effects on stream retry. Show only results confirmed by services. Persist a minimal audit receipt without secrets.

Anonymous conversations are bound to a secure opaque session with expiry. On sign-in, transfer only a conversation proven to belong to that guest session, once, and avoid mixing histories across users. Private conversations require ownership on every read. Clear private UI/cache on logout. Offer conversation deletion and document retention. Never ingest supplier notes/costs or unrelated customer records into customer retrieval.

Ground monetary and availability answers in fresh service results. Show “I cannot confirm that yet” for missing information. Do not invent testimonials, warranties, medical claims, or policy promises. Support human escalation through the configured support channel, without claiming staff are online unless that is real.

## I. Verification and definition of done

Add focused domain/integration tests and browser journeys appropriate to financial and authorization behavior. Do not rely only on mocks, snapshots, typechecking, or a successful build.

Required checks:

1. Anonymous public pages, search, chat, response payloads, serialized props, metadata, and shipped fixtures contain no catalogue prices or internal supplier fields. Signed-in homepage cards still hide prices.
2. Email/password and OAuth paths, verification/recovery, cancellation, expiry, logout, safe linking, and continuation work. Guest selection/chat resumes once on the dashboard.
3. Customer A cannot access B's order, address, cart, quote, return, conversation, attachment, or AI result through direct requests or altered IDs. Staff role boundaries also hold.
4. One persisted cart is consistent between browsing/chat, page navigation, sessions, and refresh. Variant ambiguity, stale price, stock races, duplicate tool calls, and retries are handled.
5. Server totals use exact integer arithmetic. Forged callbacks, invalid signatures, wrong amounts/currencies, duplicate events, pending payments, and repeated submissions cannot produce false paid orders or duplicate fulfilment.
6. S3 oversize/type failures and unauthorized upload/download/key access are rejected. Public images and private attachments behave differently by design.
7. Sourcing → quote → accept → order and order → supplier stages → delivery → return/support work across customer/admin views.
8. Chat is usable on all app pages, with keyboard/focus, reduced motion, mobile keyboard/safe-area behavior, route persistence, and graceful AI failure.
9. Compare homepage before/after at representative 390px and 1440px widths; also check narrow mobile/tablet and long content. Check search/filter pagination, loading/error/empty states, broken routes, and console/server errors.
10. Run typecheck, tests, production build, and a production-mode smoke test against isolated test services. State external integration tests that could not run without credentials; never label them passed.

Provide `.env.example` with documented placeholders, migration/seed commands, service setup/callback/CORS/webhook instructions, initial-admin process, worker schedule, backup/restore approach, deployment/rollback runbook, and remaining policy/configuration decisions. Use library-appropriate variable names; never expose DB/S3/AI/payment secrets through `NEXT_PUBLIC_*`.

Maintain a configuration checklist covering DB connection and engine; S3 endpoint/region/bucket/media origin; OAuth client/callback; session secret; email sender/provider; Paystack test/live keys and webhook; AI key/model; app URL; support channel; job scheduler; and approved commerce policies. Never print real secret values.

Finish with a concise handover: changed behavior, route coverage, data model, migration impact, commands/tests and actual results, tested versus untested external integrations, configuration steps, and remaining blockers. Do not describe the system as production-ready while essential integration tests, migrations, policy approval, or external configuration remain incomplete.

## J. Execution order

Phase 0: audit and homepage baseline; create a route/action inventory and progress checklist.

Phase 1: complete responsive UI/UX and navigation with safe development data contracts, including pricing gates, authentication layout, dashboard, global chat shell, and all remaining customer/admin screens.

Phase 2: implement external DB schema/migrations, server DTOs/services, real email/password + OAuth, ownership/roles, and S3.

Phase 3: persist commerce/admin workflows; implement payments, supplier confirmation, quotes, returns, and durable notifications.

Phase 4: wire real AI retrieval and authorized tools to the same domain services; test guest/member boundaries and chat continuity.

Phase 5: perform browser/integration/security checks, repair failures, document external setup, and prepare release handover.

Complete each phase coherently, then continue. Do not ask for approval after every ordinary implementation step. Report consequential business-policy choices and external setup blockers precisely; keep working on unaffected tasks. Preserve the approved homepage throughout.

Start by inspecting the existing app and capturing its baseline, then implement.

---

## Reference material for the implementer

Use installed-version documentation first and current primary sources where needed:

- Next.js: https://nextjs.org/docs/app/guides/authentication and https://nextjs.org/docs/app/guides/data-security
- Auth.js linking behavior, if selected: https://authjs.dev/reference/core/providers
- S3: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- Paystack: https://paystack.com/docs/payments/verify-payments/ and https://paystack.com/docs/payments/webhooks/
- Accessibility: https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions

These references support integration mechanics. The product decisions and acceptance criteria above are PAYDAN's requirements, not claims that the reference sites prescribe this exact architecture.
