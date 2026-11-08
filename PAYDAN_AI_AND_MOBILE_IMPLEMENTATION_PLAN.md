# PAYDAN AI Concierge and Mobile UX Implementation Plan

## 1. Outcome

Build Ask PAYDAN as a controlled shopping concierge and improve the buyer-facing mobile experience without changing the desktop visual direction the client already approved.

The first production release should let customers:

- Describe what they need in natural language.
- Receive current, relevant product results from PAYDAN's database.
- Compare products with prices shown only to authenticated customers.
- Review and explicitly confirm cart additions.
- Continue to sourcing when the catalogue has no suitable result.
- Ask about their own orders and open requests without exposing another customer's data.

The mobile work should reorganize the existing experience, not redesign the brand. Desktop layouts, typography, colour and editorial direction remain the reference.

## 2. Current-state audit

### AI foundation already present

- `AskPaydan` is mounted globally in `src/app/layout.tsx`.
- Guest and authenticated response handling already differ.
- Guest catalogue DTOs do not contain prices.
- Cart changes require a visible confirmation step.
- Existing commands are idempotent through command receipts.
- User orders and sourcing records are scoped by the authenticated viewer.
- The assistant has rate limits, message limits, timeouts and a graceful unavailable state.

### AI gaps to correct

1. `src/server/assistant.ts` injects the first 100 products into every prompt. This does not scale and can miss the right product.
2. The assistant uses JSON-mode text instead of typed tool calls.
3. Product search is not ranked against the full catalogue.
4. Product, cart and account results are mixed into one large snapshot instead of being retrieved only when needed.
5. The guest limiter currently uses a shared `guest` key instead of a per-browser or privacy-preserving IP key.
6. Tool outcomes are not streamed as structured UI events.
7. There is no representative evaluation set or AI-specific production telemetry.

### Mobile gaps visible in the current code

1. `MobileTabBar` renders five destinations while CSS allocates four columns.
2. The first bottom-navigation item is always coloured active in CSS, even though React already provides the real active state.
3. Ask PAYDAN floats above the bottom navigation and can compete with sticky purchase controls, toasts and the phone safe area.
4. Catalogue filters disappear below 600px instead of becoming a mobile filter experience.
5. A global mobile rule hides the final product card in product grids.
6. The dashboard's useful department rail becomes a plain native select on phones.
7. Product cards remain dense in a two-column layout at very narrow widths, with small text and long action labels.
8. Mobile inputs and controls use very small font sizes; this reduces readability and can trigger zoom behaviour on iOS.
9. The account navigation becomes a horizontally scrolling row without a clear current-section control.
10. The admin sidebar disappears on small screens without a replacement navigation pattern.
11. `responsive.css` is imported before later production/account styles, making responsive overrides harder to reason about.

## 3. Product decisions

### AI provider strategy

- Use the Vercel AI SDK for streaming, typed tool calls and UI message parts.
- Use Vercel AI Gateway so providers can be changed without rewriting the feature.
- Start the evaluation with `anthropic/claude-haiku-5.5` as the primary low-cost candidate.
- Use `openai/gpt-6-luna` as the first fallback/evaluation candidate.
- Do not permanently select a winner until both models run the PAYDAN evaluation suite.
- Set Gateway project and key budgets before enabling production traffic.

### Search strategy

- Start with PostgreSQL exact matching, full-text search, trigram typo tolerance and structured filters.
- Do not add embeddings in the first release.
- Record no-result and reformulated searches; add hybrid/vector search only if those measurements justify it.
- Prices, inventory and delivery availability always come from live database records, never from a search index or model memory.

### Conversation and authority

- Keep conversations session-only for the first release. Continue using browser storage with a versioned migration to the new message format.
- The model can retrieve, explain and propose. It cannot complete payments, place orders, issue refunds, change fulfilment, invent discounts or promise delivery dates.
- A separate staff copilot is a later product. The customer assistant must never receive admin tools.

### Mobile navigation

Use a five-position mobile navigation with Ask PAYDAN as the central, visually prominent action:

1. Home for guests or Dashboard for members.
2. Departments.
3. Ask PAYDAN.
4. Cart, including a quantity badge.
5. Account.

Orders move into Dashboard and Account rather than competing for a permanent bottom-navigation slot. On desktop, Ask PAYDAN remains the floating launcher.

## 4. Target AI user flows

### Guest product discovery

`Question -> search_catalog -> price-free product cards -> compare/view actions -> sign-in handoff for price or cart`

The sign-in handoff stores the selected product, variant if known, quantity and return path using the existing intent mechanism.

### Authenticated product discovery

`Question -> search_catalog -> live member product cards -> optional comparison -> cart proposal -> review -> explicit confirmation -> existing cart command`

The chat must display a clear distinction between a recommendation, a pending proposal and a completed cart update.

### Sourcing

`No suitable result -> collect requirements -> produce sourcing draft -> customer reviews -> existing sourcing form/command submits`

The draft may collect description, brand, specifications, quantity, budget, delivery state, deadline and reference image. The AI does not submit the request on its own.

### Account support

`Question -> authenticated account tool -> sanitized result -> explanation or support draft`

Order and sourcing tools derive the customer from the server session. Their schemas never accept `customerId`.

## 5. AI technical architecture

### 5.1 Provider layer

Create a small provider-neutral module, for example:

- `src/server/ai/client.ts`
- `src/server/ai/config.ts`

Responsibilities:

- Read and validate Gateway configuration.
- Select the primary and fallback model.
- Apply conservative generation limits, tool-step limits and timeouts.
- Attach non-PII observability tags such as access tier and route.
- Return the existing graceful unavailable response when AI is disabled.

Proposed production variables:

```env
AI_GATEWAY_API_KEY=
AI_MODEL_PRIMARY=anthropic/claude-haiku-5.5
AI_MODEL_FALLBACK=openai/gpt-6-luna
AI_ENABLED=false
```

Update `.env.example`, `.env.vercel` and `scripts/check-config.ts`. Remove `AI_CHAT_COMPLETIONS_URL` only after the new adapter is working and production has been migrated.

### 5.2 Server-controlled tools

Implement each tool in its own module under `src/server/ai/tools/`. All inputs and outputs use strict Zod schemas.

| Tool | Access | Behaviour |
|---|---|---|
| `search_catalog` | Guest/member | Ranked search across all published, unrestricted products; guest output contains no money fields. |
| `get_product_details` | Guest/member | Current product, variant and availability details; viewer-scoped DTO. |
| `compare_products` | Guest/member | Deterministic attribute comparison; price columns exist only for members. |
| `get_current_cart` | Member | Current viewer's cart only. |
| `propose_cart_change` | Member; guest handoff | Creates a reviewable proposal; never mutates the cart. |
| `get_my_orders` | Member | Current viewer's sanitized orders only. |
| `get_shipping_options` | Guest/member | Returns available zones and honest estimates; final fee remains a checkout calculation. |
| `search_policies` | Guest/member | Searches approved published policy copy. |
| `draft_sourcing_request` | Guest/member | Creates a client-visible draft, not a submitted request. |
| `draft_support_handoff` | Member | Prepares a support summary for customer review and submission. |

No customer-facing tool may initialize Paystack, mark payment successful, place an order, cancel a paid order, alter fulfilment or create a refund.

### 5.3 Catalogue search

Add a migration such as `migrations/003_product_search.sql` with a dedicated search projection:

- Product ID as the primary key.
- Normalized name, brand, category, description, highlights and specifications.
- A stored `tsvector` with a GIN index.
- Trigram indexes for product name, brand and SKU typo tolerance.
- Status, restriction, category and availability columns for filters.
- Updated timestamp for synchronization and diagnostics.

Backfill it from published product records. Update the projection whenever an admin creates, edits, publishes, unpublishes or deletes a product. Search ranking should prefer:

1. Exact SKU, name and brand matches.
2. Full-text matches weighted by name, brand, highlights and description.
3. Trigram similarity for misspellings.
4. Synonym expansion maintained in application code for common terms such as phone/mobile/handset.

Return at most 12 search rows and expose at most 6 result cards per assistant turn. Fetch display details, price and inventory from the source records after ranking.

### 5.4 Safe cart proposals

Add `migrations/004_assistant_proposals.sql` for short-lived proposals:

- `id`, `owner_id`, `action`, validated payload, status, expiry and timestamps.
- Statuses: `pending`, `confirmed`, `expired`, `cancelled`.
- A proposal can be confirmed once.

Flow:

1. The model selects `propose_cart_change`.
2. The server validates product, variant, quantity, publication status and availability.
3. The server creates a proposal owned by the signed-in user.
4. The UI shows the exact product, option, quantity and current price.
5. The user presses Confirm.
6. A confirmation route loads the owned, unexpired proposal and calls the existing idempotent cart command.
7. The proposal is marked confirmed and the cart snapshot refreshes.

This preserves the current confirmation boundary while preventing a client from replaying stale proposals.

### 5.5 Streaming route and structured UI

Refactor `src/app/api/assistant/route.ts` to stream AI SDK UI messages rather than return one JSON object. The route should:

- Validate message length and count.
- Derive the viewer on the server.
- Rate-limit authenticated users by user ID and guests by a privacy-preserving browser/IP key.
- Limit tool steps and tool result sizes.
- Stream text and typed tool results.
- Abort cleanly when the browser disconnects.
- Return structured, user-friendly failures without provider details.

Refactor `AskPaydan` into smaller components:

- `assistant-shell.tsx`
- `assistant-message.tsx`
- `assistant-product-results.tsx`
- `assistant-comparison.tsx`
- `assistant-cart-proposal.tsx`
- `assistant-sourcing-draft.tsx`
- `assistant-composer.tsx`

Product cards, prices and availability should be rendered from server tool results, not reconstructed from model prose.

### 5.6 Page-aware starters

Provide safe page context with each request:

- Current pathname.
- Current product or department slug when applicable.
- Authentication tier.
- Delivery state if already selected.

Examples:

- Product page: “Compare this with similar products.”
- Category page: “Help me choose from this department.”
- Cart: “Explain my cart” and “What might I be missing?”
- Order page: “Explain this status.”

The server must validate any slug or ID against the current viewer before using it.

## 6. Mobile UX workstreams

### 6.1 Responsive foundation

- Introduce shared CSS variables for mobile navigation height, safe-area inset, sticky-control offset and compact page gutters.
- Add a final `mobile-polish.css` import after production/account styles so phone overrides have a predictable cascade while the current CSS is gradually consolidated.
- Treat `<=600px` as phone and `601-900px` as tablet, with a narrow-phone adjustment around 360px rather than device-specific rules.
- Remove all rules that hide content merely to make a grid fit, including the final-product-card rule.
- Ensure no route creates page-level horizontal scrolling.
- Use `100dvh` and `env(safe-area-inset-bottom)` for full-height and fixed controls.

### 6.2 Header and navigation

Phone header layout:

- Row one: menu, compact PAYDAN logo and cart/account action.
- Row two: full-width search.
- Optional delivery-location chip below search when a location is available.

Replace the current dropdown-style mobile menu with an accessible off-canvas drawer containing account state, primary links, a scrollable department list, support links and delivery location. Lock page scroll while open, trap focus and return focus to the menu button on close.

Bottom navigation:

- Five equal columns.
- Real active state from `aria-current`; remove `:first-child` active styling.
- Ask PAYDAN is the central action and opens the full-screen assistant.
- Cart shows a count badge.
- Use distinct Home/Dashboard and Account icons.
- Add safe-area padding and minimum 44px targets.

### 6.3 Homepage

- Preserve the existing desktop composition and editorial assets.
- Tighten mobile hero height and copy width so the first CTA is visible without excessive scrolling.
- Convert dense category and editorial collections into intentional snap carousels with visible next-card affordance.
- Keep two product columns where readable; use one compact row/card layout below the narrow-phone threshold if labels or actions wrap excessively.
- Never hide the final product.
- Reduce vertical whitespace without shrinking text below readable sizes.

### 6.4 Catalogue and search

- Keep department chips horizontally scrollable with a clear active state.
- Add a sticky mobile toolbar containing result count, Filter and Sort.
- Open filters in a bottom sheet or full-height drawer with availability, member-only price and brand sections.
- Show active filter count and removable filter chips above results.
- Provide Apply and Clear actions; preserve scroll position when the sheet closes.
- Maintain two-column cards at normal phone widths and fall back to a compact single-column layout only when required.

### 6.5 Dashboard

Preserve the vertical sticky department rail on desktop and tablet. On phones:

- Replace the plain select with an active-department chip plus a “Departments” trigger.
- Open a scrollable sheet containing “For you”, department names and product counts.
- After selection, close the sheet and keep the product feed heading at the top of the viewport.
- Keep the shortcut statistics in a horizontal snap row or compact two-by-two grid.
- Keep the “Selected for your everyday” feed as the default.

### 6.6 Product details, cart and checkout

- Product detail: one image gallery, concise option controls and a sticky purchase bar positioned above mobile navigation.
- Cart: compact line cards, tap-friendly quantity controls and an order-summary accordion followed by a persistent checkout CTA.
- Checkout: one-column form, clear progress, address/payment sections and a final review summary before Paystack initialization.
- Coordinate sticky CTAs with the assistant, toast queue and safe-area offset so controls never overlap.

### 6.7 Account and authentication

- Replace the scrolling account sidebar with an “Account section” menu or sheet showing the current section.
- Use compact summary cards for orders, sourcing requests, returns and wishlist.
- Keep forms one column, with 16px inputs, visible labels and full-width primary actions.
- Improve Google sign-in and security rows without changing the desktop card styling.
- Ensure login, registration, verification and password-reset states fit above the keyboard and expose errors next to the relevant action.

### 6.8 Ask PAYDAN on mobile

- Open from the central bottom-navigation action as a full-screen `100dvh` experience.
- Use a compact header with Close, New conversation and optional Minimize actions.
- Keep the composer above the on-screen keyboard and safe-area inset.
- Render product results as horizontal snap cards; comparison as stacked attribute sections rather than a wide table.
- Keep proposal confirmation and cart summary visible without covering the composer.
- Preserve focus trapping, Escape handling, reduced motion and accessible live-region behaviour.
- When minimized on mobile, return to the central tab state rather than showing a second floating pill.

### 6.9 Footer and staff console

- Convert mobile footer columns into simple accordions while preserving all links.
- Add a mobile admin top bar and navigation drawer before calling the staff console mobile-ready.
- Convert high-priority admin tables to summary cards on phones; retain horizontal tables only as a deliberate fallback.
- Buyer mobile work is the launch priority. Staff-console mobile improvements can ship as a separate milestone.

## 7. Security and privacy requirements

- Guest tool results must contain no price, compare-at price, internal cost, vendor ID or restricted catalogue data.
- Authenticated tools derive identity and role from the session; never from tool arguments.
- Treat product descriptions, policy content and user messages as untrusted data.
- Use allowlisted tool outputs and strict schemas.
- Limit tool calls, output size, total duration and retries.
- Do not send full account snapshots or the full catalogue to a provider.
- Avoid logging raw conversations by default. Log tool name, duration, outcome, model, token count and an opaque user/session identifier.
- Never ask for passwords, OTPs, card details or API keys.
- Require confirmation for every write action.
- Maintain a hard deny list for payments, refunds, discounts, fulfilment and staff operations.

## 8. Evaluation and QA

### AI evaluation set

Create at least 60 representative prompts covering:

- Exact, broad and typo-heavy product searches.
- Nigerian English and common Pidgin phrasing.
- Product comparison and ambiguous variants.
- Empty results leading to sourcing.
- Guest attempts to reveal prices.
- Cross-account order requests.
- Prompt injection placed in product descriptions.
- Invented discounts, stock and delivery promises.
- Out-of-stock products.
- Duplicate proposal confirmation.
- Requests to take payment, refund or alter fulfilment.

Launch gates:

- Zero guest price leaks.
- Zero cross-account data exposures.
- Zero unconfirmed mutations.
- Zero claims of successful payment/refund/order placement.
- Correct tool selection and useful results on the agreed evaluation threshold.
- Graceful provider timeout and fallback behaviour.

### Mobile test matrix

Test at 320, 360, 390, 412, 600, 768 and 900 CSS pixels, including portrait and tablet landscape where relevant.

Required routes:

- Home.
- Login and registration.
- Dashboard.
- Shop, search and category.
- Product detail.
- Cart and checkout.
- Account profile, orders and sourcing.
- Ask PAYDAN closed, open, streaming, results and proposal states.

Acceptance criteria:

- No page-level horizontal overflow.
- No hidden final card or unreachable action.
- Minimum 44px interactive targets.
- Text inputs use at least 16px on phones.
- Bottom navigation, sticky CTA, toast and assistant never overlap.
- Keyboard opening does not hide the active field or chat composer.
- Filters and department selection work without losing scroll context.
- Visible focus, semantic headings, labels and current-page states remain intact.
- Production Lighthouse target: accessibility at least 95, CLS below 0.1 and no serious mobile performance regression from the current baseline.

## 9. Implementation sequence

### Milestone 0 — Baseline and guardrails

- Capture mobile screenshots and performance/accessibility baselines for required routes.
- Create the AI evaluation dataset and mock tool harness.
- Add the AI feature flag and Gateway budget.
- Add the final mobile CSS layer and shared safe-area variables.

### Milestone 1 — Mobile shell

- Fix the five-column bottom navigation and make Ask PAYDAN the central action.
- Implement the mobile header/menu drawer.
- Remove content-hiding grid rules.
- Coordinate fixed navigation, toasts, sticky CTAs and chat offsets.

### Milestone 2 — AI retrieval foundation

- Add Vercel AI SDK/Gateway adapter.
- Add the product search projection and ranking service.
- Implement read-only catalogue, product, comparison and policy tools.
- Replace the 100-product prompt with tool retrieval.
- Stream text and typed results into the existing assistant shell.

### Milestone 3 — Product discovery UI

- Add product-result and comparison components.
- Add context-aware starters.
- Complete guest/member price handling through tool DTOs.
- Add provider fallback, observability and evaluation runs.

This is the minimum valuable AI release.

### Milestone 4 — Mobile shopping pages

- Implement catalogue filter sheet and compact product cards.
- Implement the dashboard department sheet/chips.
- Polish product detail, cart, checkout, account and authentication routes.
- Convert the footer to mobile accordions.

### Milestone 5 — Confirmed actions and handoffs

- Add short-lived assistant proposals and confirmation route.
- Add sourcing drafts and sign-in continuation.
- Add own-order retrieval and support drafts.
- Keep Paystack, refunds and fulfilment outside assistant authority.

### Milestone 6 — Hardening and rollout

- Run security, evaluation, responsive and accessibility suites.
- Test both candidate models and select the primary from measured results.
- Roll out to internal accounts, then a small customer percentage, then general availability.
- Monitor no-result rate, tool errors, latency, cost per conversation, proposal confirmation and human-handoff rate.

## 10. Expected file changes

AI:

- `package.json`
- `.env.example`
- `scripts/check-config.ts`
- `migrations/003_product_search.sql`
- `migrations/004_assistant_proposals.sql`
- `src/server/assistant.ts`
- `src/server/ai/client.ts`
- `src/server/ai/search.ts`
- `src/server/ai/tools/*`
- `src/app/api/assistant/route.ts`
- `src/app/api/assistant/proposals/[id]/confirm/route.ts`
- `src/components/assistant/*`
- `tests/assistant-tools.test.ts`
- `tests/assistant-security.test.ts`

Mobile:

- `src/app/globals.css`
- `src/styles/mobile-polish.css`
- `src/styles/assistant.css`
- `src/components/storefront/site-header.tsx`
- `src/components/storefront/mobile-tab-bar.tsx`
- `src/components/storefront/site-footer.tsx`
- `src/components/catalog/catalog-view.tsx`
- `src/components/product-card.tsx`
- `src/app/(storefront)/dashboard/page.tsx`
- account, cart, checkout and product-detail components as required
- responsive component and end-to-end tests

## 11. Definition of done

The work is complete when PAYDAN has a mobile experience that feels intentionally arranged rather than compressed from desktop, and Ask PAYDAN retrieves current data through controlled tools, streams useful product results, respects guest/member access, and cannot perform a consequential action without explicit review and confirmation.
