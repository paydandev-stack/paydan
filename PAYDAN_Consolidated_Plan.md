# PAYDAN — Consolidated product and implementation plan

> Implementation update — 6 November 2026: PostgreSQL, AWS S3, Google-only OAuth and Paystack are implemented in this application. AI is provider-configurable but intentionally unconfigured. Read `docs/CONTEXT_AND_HANDOFF.md`, `docs/implementation-progress.md`, `docs/USER_FLOW_REVIEW.md` and `SETUP_AND_OPERATIONS.md` for the linked history, delivered scope, validation and required external setup. The specification below is a target, not proof that live integrations have been tested.


Prepared 4 November 2026. This document consolidates the client requirements and the agreed direction. It is a build brief, not a claim that the features are already implemented.

## 1. Product and scope

PAYDAN is a Nigerian retailer and procurement service operating one customer-facing store across multiple internally managed suppliers. Customers buy from PAYDAN; its team manages sourcing, pricing, supplier sub-orders, procurement, delivery coordination, and support. Vendor self-registration, vendor storefronts, and automated supplier payouts are outside this release.

The existing homepage design is approved. Preserve its composition, branding, imagery direction, and department structure. Make targeted changes to pricing visibility, purchase entry points, motion, and the global chat launcher. Build the missing member experience around the existing catalogue and components.

Primary journey:

**Public discovery without prices → sign in or sign up → personalized shopping dashboard → browse or chat → shared cart → review and payment → tracking and support.**

## 2. Decisions and configuration assumptions

| Item | Status and direction |
|---|---|
| Homepage appearance | Approved; retain with targeted changes |
| Homepage product prices | Never display, including to signed-in visitors |
| Anonymous prices | Never disclose through pages, search, chat, metadata, or public responses |
| Purchase access | Requires authentication; anonymous visitors may retain an unpriced selection draft |
| Member dashboard | Shopping-first, with departments, listings, prices, and personal context |
| Authentication | Email/password plus an OAuth provider button |
| OAuth provider | Google is the proposed first provider, not a confirmed client choice |
| AI access | Anonymous discovery; authenticated shopping and own-account assistance |
| Chat availability | Every application-owned page; mobile-safe and persistent across navigation |
| Database | External database confirmed; PostgreSQL recommended, provider/engine still to be supplied |
| Files/media | S3 bucket confirmed; AWS versus S3-compatible endpoint still to be supplied |
| Payments | Paystack confirmed by the client; use it for checkout payments |
| Email, AI provider, deployment | Select/configure during implementation; no credentials assumed |

The application can be built and tested with documented development services before production credentials are available. Missing credentials must never produce fake success or a silent production fallback to sample data.

## 3. Public discovery and pricing

Visitors can browse departments, collections, product imagery, descriptions, specifications, and approved availability information. Use “Sign in to view price” or “Sign in to shop.” Homepage cards show “View product” or “Continue shopping” to members, without revealing prices on the cards.

Remove price-bearing promotional copy, comparison prices, savings amounts, discount percentages, price filters, and price sort controls from anonymous surfaces. Preserve useful merchandising through labels such as “Featured” and “New arrivals.” Never invent urgency, reviews, or purchase activity.

Price privacy is an access rule, not a CSS rule. Public HTML, React payloads, JavaScript fixtures, JSON-LD, social metadata, API responses, search indexes, and AI retrieval must omit monetary catalogue fields. Private member responses must not be reused through public caching. Supplier costs, margins, and vendor contact data are never customer data.

## 4. Authentication and continuity

Use a Nexar-inspired split authentication layout with PAYDAN green/orange branding: product storytelling on the left, clear form on the right, compact form-first treatment on mobile. Include a named OAuth button, email/password, password visibility, verification, recovery, loading, cancellation, and error states.

Keep registration short. Collect delivery phone and address when required for fulfilment. Support safe account linking between password and OAuth identities.

Successful login lands on the shopping dashboard. Preserve product ID, variant, quantity, department/search context, or guest conversation as a validated pending intent. Display a resume card or reopen the relevant conversation; do not automatically place an order. Merge a guest draft only once and revalidate it against the catalogue.

Session expiry must preserve recoverable work without leaving private data visible. Sign-out clears private UI state and member chat access. Fresh sessions must not inherit another user's cart or conversation.

## 5. Member dashboard and navigation

Use `/dashboard` as the member landing route; preserve existing `/account/*` detail links and redirect `/account` to the dashboard. Existing catalogue routes can use an authentication-aware shell and strictly different public/member response shapes rather than duplicate product implementations.

Dashboard content, in order:

1. Search, delivery location, cart, notifications, and profile.
2. Personal greeting and relevant next action.
3. Resume selected item, saved basket, or recently viewed products.
4. Department tiles and product collections with prices.
5. Active order or quotation awaiting attention.
6. Buy again, saved items, sourcing request, and AI entry points.

Use a compact desktop sidebar. Suggested mobile tabs: Home, Departments, Cart, Orders, Account. The chat launcher sits above mobile navigation and never obscures purchase controls.

New accounts receive useful neutral collections and optional preferences; returning accounts receive history-based suggestions. Recommendations must not imply knowledge that the system does not have.

## 6. AI shopping assistant

Working label: **Ask PAYDAN**. A floating icon opens a large desktop panel with optional expansion and a full-screen mobile conversation. Retain the thread across navigation; do not auto-open on every page. Provide close, minimize, new conversation, accessible focus handling, and clear AI identification.

| Capability | Anonymous | Authenticated customer |
|---|---|---|
| Explain PAYDAN, policies, departments, collections | Yes | Yes |
| Find and compare published products | Specifications only; no prices | Current prices and budget comparisons |
| Prepare a shopping list | Unpriced draft | Priced selection |
| Mutate saved cart | No; sign-in handoff | Yes, on explicit request |
| Submit sourcing inquiry | Draft only | Yes, after reviewing details |
| Read orders, addresses, quotes | No | Own records only |
| Checkout | Sign-in handoff | Standard review/payment flow |
| Manage suppliers, staff, margins, refunds | No | No |

The same retail assistant may remain available on admin routes to satisfy the all-pages requirement, but staff status does not grant it internal management tools. A separate operations assistant is outside scope.

Public homepage cards remain price-free even for members; an authenticated member's explicitly opened chat can show their authorized prices. AI permission follows the validated session, not the page pathname.

Answers use current published catalogue and approved knowledge. Product suggestions combine short explanations with product cards and variant selectors. “Add two of the blue medium” resolves to a specific SKU before changing the shared cart. Show successful changes, revised subtotal, and undo only after the server confirms the mutation. Replayed requests must not duplicate additions.

Ask whether a budget includes delivery. Offer alternatives or a sourcing request when appropriate. Do not invent products, stock, prices, delivery promises, or policy terms. Never collect card details or passwords through chat. AI outages fall back to normal search and support.

Production AI uses two ordered model-vendor slots through Vercel AI Gateway: an evaluated primary and a different secondary fallback. Local development and Vercel Preview may use a separate direct Groq free-plan profile with synthetic data; the application must reject that test profile in Production. After all providers permitted by the active profile fail, use the deterministic normal-search/support experience. Keep Gateway and Groq credentials server-only, apply bounded failover without replaying mutations, and record sanitized provider/model telemetry.

## 7. Remaining commerce and operations

Complete cart editing, saved items, addresses, checkout, order confirmation, supplier-group tracking, sourcing/quotation acceptance, returns, and support. Show payment and fulfilment separately. Explain split deliveries in customer language.

Internal administration must support products/variants/media, categories, suppliers, orders and sub-orders, procurement, sourcing quotes, customers, promotions/content, returns, settings, staff permissions, and audit history. Keep this operationally focused; do not add vendor portals or speculative finance products.

For supplier-confirmed products, require availability confirmation and an accepted quote before charging unless the business explicitly approves another policy. A mixed basket can separate confirmed purchases from request-only items with an explanation. Never promise a paid purchase is ready when the supplier is unconfirmed.

Recovery states are part of completion: expired sign-in, unavailable variant, changed price, invalid voucher, payment pending/failed, expired quote, split shipment, rejected return, upload failure, and AI timeout.

## 8. Architecture and external services

Retain the Next.js App Router, TypeScript, reusable components, and current styling system. Verify installed-version documentation before implementation; the inspected package declares Next.js 16.4.4, React 19.3.1, and Tailwind 4.3.3.

Use server-only domain services and a data-access layer between UI/AI and external systems. Centralize permission checks and return small public/customer/admin data objects. Browser storage may hold harmless transient preferences and guest drafts, not authoritative users, prices, orders, or inventory.

The external database stores identities, catalogue records, inventory/availability, carts, order snapshots, payments, supplier groups, sourcing, quotes, returns, conversation ownership, permissions, media metadata, and audit history. Use versioned migrations, indexes, constraints, transactions, and integer kobo amounts.

S3 holds file bytes; the database stores object keys and metadata. Separate public product images from private sourcing/return attachments. Authorize upload requests, issue short-lived scoped upload permissions, generate unique object keys, validate uploaded files, and authorize private downloads. Do not make the whole bucket public.

Paystack is the confirmed payment provider. The customer reviews the order in PAYDAN, continues to Paystack's payment interface, and returns to a PAYDAN confirmation or pending-payment view. Offer only payment methods enabled and supported for the configured Paystack account. Supplier sub-orders remain internal fulfilment groups; they do not imply Paystack split payouts.

Initialize transactions server-side using server-calculated NGN totals in integer kobo and unique payment references. Verify Paystack outcomes and the expected order, amount, and currency before marking an order paid. Authenticate and deduplicate webhooks/callbacks, reconcile pending transactions, and prevent duplicate fulfilment. Persist notification jobs so orders do not lose their confirmation email when an email provider is temporarily unavailable.

Configure separate Paystack test/live credentials, callback and webhook URLs, and supported payment channels. Keep secret keys server-only. Complete test-mode checkout and failure/retry/webhook checks before enabling live payments; report any tests blocked by missing credentials. Refunds require an authorized workflow and verified provider status, not a manual success toggle.

## 9. Motion and quality

Preserve homepage layout. Use gentle once-only section reveals, restrained card feedback, short button transitions, and smooth chat expansion. Suggested timings: 150–250 ms controls, 300–450 ms larger transitions, 8–12 px reveal movement. Avoid animation that delays catalogue visibility. Honor reduced motion.

Validate representative mobile, tablet, and desktop sizes, keyboard navigation, dialog focus, contrast, long names, empty states, slow connections, and recovery. Product search, filters, pagination, and images must remain performant with a realistic catalogue size.

## 10. Delivery sequence and completion

1. Audit existing routes and establish screenshots, route coverage, and a data-boundary plan.
2. Finish the UI/UX using safe, clearly isolated development fixtures.
3. Implement external DB, real authentication, OAuth, S3, and persistent domain services.
4. Complete checkout, payments, supplier operations, sourcing, returns, and notifications.
5. Connect AI read tools, then authenticated cart/account tools to the same domain services.
6. Run integration, permission, payment, browser, and accessibility checks; prepare deployment documentation.

Release acceptance must prove: no anonymous price leaks; no cross-customer reads or writes; homepage appearance preserved; every visible control has real behavior; shared chat/cart state; verified payment state; private attachment access; successful lifecycle from discovery through fulfilment/support.

Report separately what is implemented, locally tested, tested against external services, and awaiting production configuration. Do not equate a working demo with a production-ready service.

## 11. Reference notes

- [Nexar homepage](https://nexarhq.com/) and [authentication](https://app.nexarhq.com/): observed public layout and motion inspiration. No authenticated dashboard was inspected.
- [Baymard checkout research](https://baymard.com/research-articles/make-guest-checkout-prominent): account requirements introduce friction; preserve the client's gate while minimizing its steps.
- [Next.js authentication](https://nextjs.org/docs/app/guides/authentication) and [data security](https://nextjs.org/docs/app/guides/data-security): authorization belongs near server data access, with restricted response objects.
- [Auth.js providers](https://authjs.dev/reference/core/providers): automatic account linking across arbitrary providers is disabled by default for security reasons; inspect the chosen library's current behavior.
- [S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html): temporary object access; signatures can be reused until expiration and an existing object key can be overwritten.
- [Paystack verification](https://paystack.com/docs/payments/verify-payments/) and [webhooks](https://paystack.com/docs/payments/webhooks/): verify transaction state server-side and authenticate provider events.
- [W3C animation guidance](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions): support disabling nonessential interaction motion.
