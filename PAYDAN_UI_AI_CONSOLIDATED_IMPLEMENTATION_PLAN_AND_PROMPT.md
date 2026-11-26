# PAYDAN UI Tightening and AI Commerce Consolidated Implementation Plan and Prompt

> Prepared 25 November 2026 for the existing `paydan-next` application.
>
> This is both the readable implementation plan and the execution prompt for Codex or Claude. It defines the required result; it is not evidence that the work has already been completed. The implementing agent must audit the current checkout and retain already-correct work instead of recreating it.

---

## Execution prompt

You are the lead product designer and full-stack engineer completing and polishing the existing PAYDAN application. Work directly in the current `paydan-next` repository and implement this document fully. Do not stop after restating the plan, producing a mock-up, or completing only the most visible screen.

The final result must combine:

1. A professional UI-tightening pass across the public storefront, signed-in shopping experience, customer account surfaces, and staff admin console.
2. Removal of Vercel AI Gateway and replacement with the adopted Groq to OpenRouter to deterministic assistant chain.
3. Expanded catalogue coverage, controlled cart proposals, deterministic assistant behaviour, and chat UI improvements.
4. Reusable password controls, header action corrections, and compact desktop/tablet behaviour.
5. Automated verification, visual QA, deployment documentation, and a clear completion report.

The adopted external assistant routing order is:

```text
Direct Groq
    ↓ transient failure, rate limit, or model unavailable
OpenRouter Free
    ↓ unavailable
PAYDAN deterministic assistant
```

Vercel AI Gateway must be removed completely.

## 1. Working rules and source-of-truth order

Primary application:

```text
C:\Users\PRAISE\Desktop\paydan\paydan\paydan-next
```

Before writing application code:

1. Read the repository `AGENTS.md` and any applicable `CLAUDE.md`.
2. Inspect `git status`, recent commits, the package versions, and the current implementation.
3. Read the relevant installed Next.js documentation under `node_modules/next/dist/docs/`; this repository uses a version whose APIs and conventions may differ from prior knowledge.
4. Inspect the live component, route, service, migration, configuration, and test code. Plans and old status documents are context, not proof of implementation.
5. Capture baseline screenshots before visual edits.
6. Do not print secrets, private keys, credentials, access tokens, or sensitive environment values.

When requirements conflict, use this order:

1. The user's latest explicit instructions.
2. This consolidated document.
3. Current repository instructions such as `AGENTS.md`.
4. Current product/security invariants established in code.
5. Older plans and prompts.

This document supersedes older Vercel AI Gateway directions in files such as:

- `CLAUDE_PAYDAN_Implementation_Prompt.md`
- `PAYDAN_AI_AND_MOBILE_IMPLEMENTATION_PLAN.md`
- `PAYDAN_Consolidated_Plan.md`
- `PRODUCTION_SERVICES.md`
- `SETUP_AND_OPERATIONS.md`
- React Native plans that still describe Gateway as part of the server architecture

Update those documents where they are intended to describe current architecture. Do not leave contradictory production instructions behind.

Use existing components and services where sound. Some proposal infrastructure, provider routing, customer/admin routes, vendor tooling, and production services already exist. Extend or refactor them; do not create a parallel implementation.

Keep changes reviewable, preserve unrelated work, and maintain `docs/implementation-progress.md` with:

- Completed scope.
- Remaining scope.
- Tests and visual QA performed.
- Configuration and external-service blockers.
- Migrations or deployment actions still required.

If credentials are missing, complete all independent implementation and automated testing. Report only the credential-dependent live verification as blocked.

## 2. PAYDAN product and brand invariants

PAYDAN is a Nigerian, PAYDAN-branded commerce and procurement experience. Preserve:

- The official green and orange brand identity.
- Green as the primary interaction and navigation colour.
- Orange as a sparing promotional, warning, or attention accent.
- Newsreader/editorial headings where they strengthen brand character.
- Manrope for clear interface text.
- NGN and `en-NG` formatting.
- The approved homepage composition and overall visual character.
- Department-led discovery, product grids, search, sourcing, wishlist, cart, orders, returns, and support.
- Dashboard-first shopping after sign-in, with personal information surrounding shopping content rather than replacing it.
- The existing rule that public/guest surfaces do not disclose protected member pricing.
- Explicit confirmation before an AI-requested cart mutation.

The UI work is refinement, not a brand replacement. It must make the existing product feel more coherent, mature, shaped, and interactive without turning it into a generic template.

Do not invent delivery promises, return periods, payment guarantees, ratings, stock urgency, supplier claims, or policy terms. Use only approved or configurable business information.

## 3. Audit-first checkpoint

Before implementation, create a current-state matrix for every requirement in this document:

```text
Requirement | Existing implementation | Gap | Files | Validation needed
```

Verify at least:

- Whether `@ai-sdk/gateway` and `createGateway` remain in the project.
- Every occurrence of `AI_GATEWAY_API_KEY`, `AI_PRIMARY_MODEL`, and `AI_SECONDARY_MODEL`.
- Current Groq provider, routing, cooldown, output-start, logging, and fallback behaviour.
- Whether OpenRouter exists already and whether it is truly independent.
- Existing `assistant_proposal` schema, service, routes, expiration, confirmation, and idempotency behaviour.
- Current deterministic assistant intents and catalogue tools.
- Existing test-buyer scope and `TEST_DATA_VERSION` behaviour.
- Current password controls and Better Auth request payloads.
- Current Updates header markup and icons.
- Storefront and admin responsiveness at all target widths.
- Current public/member catalogue DTO boundaries and price privacy.

Do not mark a requirement complete from filenames or documentation alone. Trace the actual runtime path and tests.

---

# Part I — UI tightening programme

## 4. Visual objective

The storefront should feel like a warm, modern department store: strong product presentation, compact and readable information, confident buying actions, and controlled editorial character.

The admin console should feel like a calm operations workspace: clear status, readable density, quick scanning, and efficient action placement.

“Tightening” includes:

- Replacing amateur-looking or platform-dependent symbols with coherent icons.
- Correcting oversized and undersized typography and controls.
- Making hierarchy and primary actions immediately clear.
- Giving plain line-based sections more intentional shape and structure.
- Improving alignment, rhythm, grouping, density, and responsive behaviour.
- Adding restrained motion and complete interaction states.
- Standardising loading, empty, error, success, disabled, pending, and destructive states.
- Improving visual quality without sacrificing speed, accessibility, UX, or PAYDAN branding.

## 5. Current UI issues to verify and resolve

The initial repository audit found the following patterns. Re-measure them before editing because the code may have changed:

- Hundreds of independent `font-size` declarations, including interface text around `0.48rem` to `0.72rem`.
- Product and catalogue headings reaching approximately `4.4rem` to `5rem` beside much smaller metadata and controls.
- Admin tables and sidebar labels rendered at approximately 9–11px.
- A global SVG size combined with component-specific overrides rather than a deliberate icon-size system.
- Unicode symbols such as `◇`, `▦`, `＋`, `↗`, `☰`, `×`, and text arrows used as interface icons.
- Numerous admin inline styles and overlapping base/additions/production CSS rules.
- Line-only cards, dashed empty states, and thin borders used repeatedly without enough visual hierarchy.
- Motion concentrated in a few hero/product-card interactions while drawers, filters, state changes, and admin actions remain abrupt.
- Inconsistent button, input, card, status, table, filter, and notice variants.
- A signed-in Updates action that does not match Wishlist, Dashboard, and Cart.

## 6. Design foundations

### 6.1 Typography

Create a small, documented type scale and use it consistently. Suggested interface roles:

| Role                    | Suggested range       | Purpose                                             |
| ----------------------- | --------------------- | --------------------------------------------------- |
| Micro metadata          | 12px minimum          | Timestamps, tertiary metadata, compact chart labels |
| Supporting UI           | 13–14px               | Labels, table cells, filters, help text             |
| Body and controls       | 14–16px               | Forms, descriptions, buttons, navigation            |
| Card and panel headings | 16–20px               | Product titles, admin panels, summaries             |
| Section headings        | 24–40px               | Storefront and dashboard hierarchy                  |
| Display headings        | Responsive and capped | Hero/editorial moments only                         |

Do not use tiny text to create elegance. Use colour, weight, spacing, and hierarchy.

### 6.2 Spacing and layout

Use a consistent spacing scale based on:

```text
4, 8, 12, 16, 24, 32, 48, 64px
```

Standardise content widths, gutters, section spacing, grid gaps, panel padding, and row heights. Remove page-specific alignment hacks where a shared layout primitive can solve the same problem.

### 6.3 Icons

Extend the existing SVG icon system and standardise visible sizes:

```text
16px compact
20px standard
24px navigation and important actions
```

Add or confirm icons for:

- Bell/notifications.
- Search.
- Filter and sort.
- Add, edit, duplicate, archive, delete, and overflow.
- Refresh/retry.
- External link.
- Orders, returns, customers, catalogue, inventory, vendors, analytics, settings, audit, and support.
- Success, warning, error, information, pending, and unavailable states.

Replace text glyphs used as icons. Every icon-only control needs an accessible name and an adequate target.

### 6.4 Shared interface primitives

Create or consolidate reusable primitives for:

- Primary, secondary, quiet, destructive, and icon buttons.
- Inputs, password fields, search fields, selects, textareas, checkboxes, radios, and switches.
- Cards, metric cards, action cards, notices, badges, and status pills.
- Tooltips, popovers, menus, drawers, dialogs, and confirmation panels.
- Tables, row actions, filters, active-filter chips, pagination, and bulk actions.
- Empty states, skeletons, spinners, progress indicators, and retry states.
- Toasts with consistent success, warning, information, and error treatment.

Document these primitives in the existing design-system route or an equivalent internal surface.

### 6.5 Shape, depth, and colour

Use borders, surface colours, radius, and shadow intentionally:

- Borders organise dense operational data.
- Soft green/cream surfaces group related storefront content.
- Orange highlights promotion or attention, not ordinary navigation.
- Shadows signal overlays, lifted actions, or interactive cards rather than decorating every box.
- Dashed borders are reserved for true upload/drop areas or deliberately unfinished states.

## 7. Storefront tightening

### 7.1 Header and navigation

- Reduce excessive desktop header height and logo footprint while retaining brand presence.
- Keep search as the central functional element.
- Give Updates, Wishlist, My dashboard, and Cart one shared icon/label/badge structure.
- Add the specified Bell icon and anchor its unread badge to the icon.
- Add clear hover, focus, pressed, and active-route states.
- Improve department menu grouping, item hit areas, and selected states.
- Use a compact sticky state after the shopper scrolls, provided it does not obscure content.
- At tablet/compact desktop widths, deliberately reduce gaps and padding instead of allowing labels to wrap or collide.

### 7.2 Homepage

- Preserve the approved composition, imagery direction, department order, and overall character.
- Refine heading scale at medium widths.
- Use consistent category tiles with controlled icons or imagery.
- Strengthen section separation through spacing and subtle surfaces rather than extra horizontal rules.
- Make promotional and sourcing panels feel intentional, not like placeholder blocks.
- Apply subtle once-only entry motion and card feedback.
- Keep performance and product discoverability ahead of decorative animation.

### 7.3 Signed-in dashboard

- Preserve shopping as the dominant content.
- Upgrade shortcuts with coherent icons, supporting labels, and meaningful counts.
- Turn “Needs attention” into a strong next-action panel with appropriate warning emphasis.
- Improve active order, sourcing, recently viewed, buy-again, saved-item, and cart summaries.
- Refine department navigation and selected states.
- Ensure personal context frames the catalogue rather than becoming a generic analytics dashboard.

### 7.4 Product cards

Use one predictable information order:

1. Vendor and promotional tags.
2. Product image.
3. Category or brand.
4. Product name.
5. Rating and review count when genuine data exists.
6. Member price when authorised.
7. Availability or delivery/confirmation signal.
8. Primary action.

Requirements:

- Use a stable image canvas and choose `contain` or `cover` according to product imagery rather than cropping packaged goods indiscriminately.
- Increase small metadata and product-name readability.
- Keep vendor tags compact and prevent long names from overwhelming the image.
- Give the whole card clear hover and keyboard focus treatment.
- Keep card heights balanced without truncating essential attributes.
- Provide immediate, non-disruptive add-to-cart feedback.
- Preserve guest price privacy and member pricing rules.

### 7.5 Product listings, categories, and search

- Combine result count, sort, filter trigger, and view controls into a clear toolbar.
- Show applied filters as removable chips.
- Give desktop filters a contained, grouped panel.
- Use a mobile filter drawer or bottom sheet with a clear apply/show-results action.
- Preserve category-specific filters and attributes; do not force every department into one generic schema.
- Improve empty searches with suggested departments and the sourcing-request flow.
- Provide loading states shaped like real product cards.
- Keep pagination or controlled incremental loading understandable and accessible.

### 7.6 Product detail

- Reduce the maximum product-title size and rebalance it with purchase controls.
- Preserve the eyebrow pattern:

```text
CATEGORY · BRAND · VENDOR
```

- Use a contained gallery with a clear active thumbnail, keyboard operation, and zoom affordance where useful.
- Create a stronger purchase area containing price, availability, variants, quantity, add-to-cart, and wishlist.
- Make selected, unavailable, and out-of-stock variants obvious.
- Present availability, delivery, returns, and support as structured assurance blocks with appropriate icons.
- Use structured description/specification sections and mobile-friendly disclosure controls.
- Add related products and recently viewed items beneath the primary content.

### 7.7 Cart and checkout

- Use deliberate item cards and a clear, sticky order summary on larger screens.
- Separate subtotal, delivery estimate, discount, and total visually.
- Improve quantity, remove, and save actions with icons and immediate feedback.
- Use a restrained checkout progress indicator.
- Keep mobile checkout actions easy to reach without covering content.
- Provide field-level validation, a concise summary error, retry behaviour, and session-expiry recovery.
- Do not let visual polish obscure payment or availability truth.

### 7.8 Customer account, orders, returns, and sourcing

- Use consistent page headers, status summaries, timelines, and next actions.
- Make order/payment/fulfilment states distinct.
- Improve address, profile, notification, support, sourcing, and returns forms with the shared primitives.
- Use informative empty states and recovery paths.
- Keep private records visually distinct from public shopping content without losing the PAYDAN identity.

### 7.9 Authentication

- Preserve the established PAYDAN/Nexar-inspired split composition.
- Improve spacing, provider button hierarchy, field grouping, validation, and mobile presentation.
- Use the reusable PasswordField specified later in this document.
- Keep motion restrained and never move form fields unexpectedly during validation.

### 7.10 Mobile storefront

- Keep the mobile bottom navigation and raised Ask PAYDAN action.
- Strengthen active-tab indication and safe-area spacing.
- Keep icon sizes and labels consistent.
- Ensure sticky purchase controls, assistant, keyboard, drawers, and navigation never overlap.
- Use comfortable touch targets and preserve a clear content hierarchy at 320–430px widths.

## 8. Admin-console tightening

### 8.1 Admin shell and navigation

- Add coherent icons to sidebar items.
- Strengthen the active route with a controlled surface and indicator.
- Clarify group headings and spacing.
- Add a compact top bar for page context, search, notifications, and staff profile where useful.
- Allow sensible group collapsing without hiding daily actions.
- Make the mobile admin drawer mirror the same hierarchy, icons, and active states.
- Preserve permission-aware navigation.

### 8.2 Page headers and action hierarchy

- Standardise eyebrow, title, description, primary action, and secondary actions.
- Use one primary action per page region.
- Place export, refresh, filter, and destructive actions consistently.
- Keep titles readable and appropriately scaled for operational screens.

### 8.3 Dashboard and metrics

- Prioritise four to six primary KPIs rather than treating every metric equally.
- Add icons and restrained status/trend cues.
- Show comparisons only when supported by real data.
- Convert operations health into clear healthy, attention, blocked, or unavailable tiles.
- Replace quick-action glyphs with SVG icons.
- Group recent orders, attention queues, activity, and launch health into clear panels.

### 8.4 Tables and resource indexes

This is a high-priority admin improvement.

- Increase table text to a readable 13–14px range.
- Use consistent 48–52px row density, with an optional compact mode only if genuinely useful.
- Add sticky headers, row hover/focus states, sensible column alignment, and product thumbnails where relevant.
- Include visible search, sort state, filter chips, result counts, and pagination.
- Support row selection and a bulk-action bar for appropriate resources.
- Move secondary row actions into a consistent overflow menu.
- Use status pills with a defined semantic colour system.
- Preserve keyboard navigation and accessible table relationships.
- Convert dense tables into structured card lists at narrow widths.
- Use designed empty states with an icon, explanation, and primary action.

### 8.5 Forms, editors, and detail pages

- Break long forms into named sections.
- Use a two-column desktop pattern: primary editing content and a narrower status, summary, or preview column.
- Keep save/publish actions in a polished sticky action bar where forms are long.
- Add clear saved, saving, error, and unsaved-change states.
- Use inline validation and concise helper text.
- Standardise confirmation dialogs for destructive or irreversible actions.
- Give order, customer, vendor, product, sourcing, return, and procurement details consistent summary headers and timelines.

### 8.6 Media management

- Turn product media upload into a real gallery manager.
- Show upload progress, failure, retry, and validation.
- Support ordering, primary-image selection, preview, and removal.
- Keep public catalogue assets separate from private attachments.
- Do not allow unvalidated media to publish.

### 8.7 Analytics

- Group metrics into revenue, orders, customers, products, vendors, and operations.
- Upgrade simple bars into charts with labels, axes, values, tooltips, and empty/loading states.
- Keep underlying tables available so charts remain actionable.
- Ensure colour is not the only means of communicating status or series.

### 8.8 Vendor management

- Preserve the existing product-to-vendor assignment and storefront vendor display.
- Improve vendor indexes and profiles with clear identity, contact, location, access, product, workload, and status groupings.
- Make vendor invitation/portal status explicit.
- Do not expose private vendor contact, cost, margin, or payout information through public catalogue DTOs.

The existing vendor portal should inherit the tightened primitives after storefront and admin priority work. Do not remove it as part of UI cleanup.

## 9. Motion and interaction system

Motion must explain state, not decorate every element.

Suggested timings:

```text
Hover/press/focus feedback: 120–200ms
Drawers, dialogs, and larger transitions: 220–350ms
Section reveal movement: approximately 8–12px, once only
```

Apply restrained motion to:

- Menus, filters, drawers, and dialogs.
- Button loading and success feedback.
- Toast entrance and dismissal.
- Product-card image and lift feedback.
- Accordions and disclosures.
- Confirmed status changes.
- Skeleton-to-content transitions.

Honor `prefers-reduced-motion`. Content and functionality must remain complete without animation.

## 10. Accessibility and responsive standards

- Maintain a visible, high-contrast focus state.
- Ensure all controls have accessible names and correct roles/states.
- Use at least the WCAG 2.2 minimum target-size/spacing requirement; prefer approximately 44px controls for important mobile actions.
- Do not rely on colour alone.
- Keep text readable at 200% zoom and layouts usable during reflow.
- Test keyboard-only navigation, screen readers, long names, validation, dialogs, drawers, menus, and status announcements.
- Preserve reduced-motion support.

Capture baseline and final screenshots at:

```text
390px
768px
920px
1024px
1150px
1280px
1440px
```

Cover at least:

- Homepage.
- Shop/search/category listing.
- Product detail.
- Cart and checkout.
- Signed-in dashboard.
- Login, registration, and password reset.
- Account orders and order detail.
- Admin dashboard.
- Products, orders, inventory, vendors, and customers indexes.
- Product editor.
- Order/vendor/customer detail.
- Analytics and settings.
- Assistant expanded, minimized, loading, proposal, and error states.

---

# Part II — AI, catalogue, cart, authentication, and responsive implementation

## 11. Remove Vercel AI Gateway

- Remove `@ai-sdk/gateway` from dependencies and lockfile.
- Remove all `createGateway` integration code.
- Delete Gateway-specific routing, provider metadata, configuration, cooldowns, and error handling.
- Remove these environment variables and every documentation/configuration reference:

```ini
AI_GATEWAY_API_KEY
AI_PRIMARY_MODEL
AI_SECONDARY_MODEL
```

- Remove or rewrite Gateway-specific tests, including assumptions such as `RestrictedModelsError → Groq`.
- Update configuration checks, production-readiness checks, launch-readiness UI, setup documentation, service documentation, and deployment instructions so Gateway is no longer expected.
- Search the entire repository after implementation and prove that no active Gateway dependency, configuration, or architecture description remains.

Do not confuse a model-access `403` with a network/transient failure. With Gateway removed, provider-specific authentication and configuration errors must be classified accurately.

## 12. Implement the provider chain

Create two independent OpenAI-compatible adapters:

1. Direct Groq using `https://api.groq.com/openai/v1`.
2. OpenRouter using `https://openrouter.ai/api/v1`.

The routing order is always:

```text
Groq → OpenRouter → deterministic assistant
```

### 12.1 Eligible pre-output failover

Move from Groq to OpenRouter only when Groq fails before producing any text, reasoning fragment exposed to the caller, tool call, tool result, or other externally visible output because of:

- Timeout.
- Network/connection failure.
- HTTP `408`.
- HTTP `429`.
- Provider `5xx`.
- Model temporarily unavailable or provider capacity exhaustion.

Apply the same eligible pre-output rules when moving from OpenRouter to the deterministic assistant.

### 12.2 No-replay failures

Do not replay through another provider for:

- Invalid requests.
- Malformed messages or tools.
- Schema/validation failures.
- Browser/client cancellation.
- Explicit content/policy rejection where retrying another provider would not be appropriate.
- Genuine credential/authentication/configuration failure that should be reported to operations.
- Any failure after text, tool calls, or tool results have begun.

Never mix output from two providers in one response. Never retry a mutation-producing turn after output has started.

### 12.3 Configuration errors and graceful degradation

- Log genuine missing/invalid credentials as sanitized configuration errors.
- Never expose provider secrets, raw provider payloads, stack traces, or internal model errors to customers.
- Missing external credentials must skip to the next configured provider or deterministic assistant without crashing the endpoint.
- Keep separate, short provider cooldowns so one unavailable service is not repeatedly called.
- Do not let one provider's cooldown suppress the other provider.
- Reset cooldown state carefully after a successful probe or expiry.

### 12.4 Telemetry

Retain sanitized logs for:

- Chosen provider and model identifier.
- Attempt order.
- Latency.
- Outcome classification.
- Whether output had started.
- Failover reason category.
- Cooldown state.

Never log prompts containing sensitive customer data by default, provider keys, authorization headers, raw tool payloads with private records, or full customer conversations.

## 13. AI environment variables

Production configuration becomes:

```ini
AI_PROVIDER_PROFILE=production
AI_PROVIDER_TIMEOUT_MS=12000

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_URL=https://paydan.store
OPENROUTER_APP_NAME=PAYDAN
```

Update:

- `.env.example`.
- `.env.docker.example`.
- Any safe configuration schema or validator.
- Vercel configuration documentation.
- Production-readiness checks.
- Launch-readiness UI.
- Provider failover tests.
- Operations/setup documents.
- Any mobile/server architecture document that still lists Gateway.

Do not add real credentials to tracked files. Do not print existing credential values while auditing.

## 14. Improve demo catalogue coverage

- Add representative test products to every visible department.
- Include shoes, sneakers, bags, clothing, and other common demo searches.
- Give products realistic names, descriptions, specifications, variants, availability, imagery references, and member pricing.
- Keep test fixtures internally consistent: category, brand, vendor, variants, SKU, stock/availability, and publication state.
- Increment `TEST_DATA_VERSION` so the existing test buyer receives the updated fixtures.
- Preserve strict separation between test-buyer data and production catalogue/customer data.
- Ensure catalogue tools search the test scope when the authenticated user is the test buyer.
- Prove that real customers cannot see test products or test records.
- When there is no match, offer the appropriate department and sourcing-request flow instead of inventing a product.

## 15. Expand controlled cart capabilities

Create or extend one shared proposal service supporting:

```text
add_to_cart
remove_cart_line
set_cart_quantity
clear_cart
```

Both external providers and the deterministic assistant must use this same service.

Requirements:

- Signed-in users only.
- Validate session, cart ownership, product, variant, availability, and quantity server-side.
- Store short-lived, owner-bound proposals.
- Display exactly what will change before confirmation.
- Require explicit confirmation.
- Support cancellation.
- Expire proposals safely.
- Make confirmation idempotent.
- Prevent confirmation by another user or session owner.
- Prevent repeated confirmation from applying twice.
- Recalculate affected cart state server-side.
- Never allow the model to place an order, initialize payment, or mark payment complete.

Examples:

- “Remove the items in my cart” creates a `clear_cart` proposal showing the affected line count and, where useful, the affected products. It must not empty the cart immediately.
- “Change this quantity to three” resolves the intended line and creates a `set_cart_quantity` proposal showing old and new quantity.
- “Remove this item” must clarify ambiguity when several cart lines could match.

## 16. Improve deterministic assistant intelligence

Add explicit, tested handling for:

- “Show me shoes.”
- “What is in my cart?”
- “Remove this item.”
- “Clear my cart.”
- “Change this quantity.”
- “Find something cheaper.”
- “Compare these products.”
- “I can’t find this product.”

The deterministic assistant must reuse the same catalogue search, authorization, cart-read, comparison, and proposal services as the external providers.

It must distinguish and communicate safely:

- No matching products.
- Authentication required.
- External AI unavailable.
- Requested action requires confirmation.
- Ambiguous product or cart line.
- Product or variant unavailable.
- Proposal expired or already resolved.
- A sourcing request is the appropriate next step.

Do not make the deterministic assistant a generic apology. It should provide useful catalogue results, cart summaries, confirmation proposals, department links, sourcing handoff, and support paths using verified application data.

## 17. Improve the chat interface

- Render catalogue results as compact product cards.
- Show product image where available, product name, availability, authorised member price, vendor/brand context where appropriate, and product link.
- Continue hiding prices from guests.
- Render action-specific cart proposal summaries.
- Add explicit **Confirm** and **Cancel** controls.
- Show pending, confirming, confirmed, cancelled, expired, failed, and already-confirmed states.
- Disable or remove controls when a proposal can no longer be acted on.
- Prevent repeated confirmation.
- Provide clear retry behaviour for safe read-only failures.
- Keep provider errors out of customer-facing messages.
- Keep sanitized provider/model, latency, outcome, and failover logs for operations.
- Keep the interface usable at narrow mobile widths and minimized desktop sizes.
- Preserve focus management, keyboard controls, labelled actions, live-region restraint, and return focus on close.
- Never let the chat panel cover the mobile navigation, keyboard, checkout actions, or important page controls.

## 18. Add the reusable PasswordField

Create one accessible `PasswordField` component with:

- Show/hide eye button.
- Proper `aria-label` and `aria-pressed`.
- Independent visibility state per field.
- Correct `current-password` and `new-password` autocomplete values.
- Password-manager and paste support.
- Consistent validation/helper text.
- A comfortable mobile touch target.
- Visible keyboard focus.

Apply it to:

- Buyer login: password visibility.
- Admin login: password visibility.
- Registration: password visibility and confirm-password field.
- Reset password: new-password visibility and confirmation field.

Do not add password fields to:

- Forgot-password page.
- Email-verification page.
- Google sign-in.

Keep profile password changes on the existing secure email-reset flow. A direct current/new/confirm profile form remains outside this scope unless explicitly requested later.

Registration must send an explicit Better Auth payload:

```ts
{
  name,
  email,
  password,
  callbackURL,
}
```

Do not spread form state into the request. `confirmPassword` must never enter the Better Auth payload.

## 19. Password validation behaviour

- Require registration password and confirmation to match.
- Require reset password and confirmation to match.
- Preserve the current 12-character minimum.
- Show accessible mismatch messaging before submission.
- Associate errors with their fields.
- Clear stale mismatch errors when the user edits either password field.
- Validate the actual password again on the server.
- Never log, persist, or transmit the confirmation value.
- Preserve password-manager compatibility and allow paste.
- Verify buyer and admin login still work after the shared component is introduced.

## 20. Fix the Updates header action

- Add a 24×24 outline `BellIcon` matching the existing SVG icon system.
- Give Updates, Wishlist, My dashboard, and Cart a shared action structure:

```text
Icon wrapper
Label
Optional badge
```

- Anchor the unread badge to the bell icon.
- Stop using the cart-specific class for Updates.
- Give every action equal icon dimensions, spacing, target size, and label alignment.
- Add clear hover, focus, pressed, and active-page states.
- Ensure badges do not shift labels or action widths.
- Check zero, single-digit, and multi-digit badge counts.

## 21. Improve minimized desktop layout

Add a compact desktop/tablet breakpoint around `901–1150px`:

- Reduce header gaps.
- Reduce search-button horizontal padding.
- Use equal-width action columns or another stable alignment system.
- Prevent labels from wrapping.
- Ensure the search field retains useful width.
- Keep location and actions readable without crowding.
- Keep the full desktop layout above the breakpoint.
- Preserve the existing mobile navigation below 900px.

Test specifically at:

```text
920px
1024px
1150px
1280px
1440px
```

Also confirm that browser zoom and long account labels do not break the layout.

---

# Part III — Verification, delivery, and completion

## 22. Automated verification

Add meaningful tests for the behaviour below. Extend existing tests when possible instead of mirroring implementation details.

### Provider routing

- Groq success does not invoke OpenRouter.
- Groq `429` before output invokes OpenRouter.
- Groq timeout before output invokes OpenRouter.
- Groq network failure before output invokes OpenRouter.
- Groq `5xx` before output invokes OpenRouter.
- Groq temporary model unavailability before output invokes OpenRouter.
- Groq failure after streamed text produces no replay.
- Groq failure after tool output produces no replay.
- Invalid request produces no provider replay.
- Browser cancellation produces no provider replay.
- Missing Groq credentials degrade to OpenRouter or deterministic assistant.
- Missing OpenRouter credentials degrade to deterministic assistant.
- Both external providers unavailable use deterministic assistant.
- Provider cooldowns remain separate.
- One response never combines providers.

### Catalogue and scope

- Test buyer can find footwear, including shoes or sneakers.
- Representative visible departments contain test products.
- Test data never leaks to real customers.
- Public catalogue DTOs retain price privacy.
- Empty search offers department/sourcing paths and does not invent products.

### Cart proposals

- Add proposal requires confirmation.
- Remove-line proposal requires confirmation.
- Quantity-change proposal requires confirmation.
- Clear-cart proposal requires confirmation and reports affected lines.
- Confirmation is owner-bound and idempotent.
- Cancelled proposals cannot mutate the cart.
- Expired proposals cannot mutate the cart.
- Already-confirmed proposals cannot mutate twice.
- Invalid or unavailable variants are rejected server-side.
- The assistant cannot place an order or initiate payment.

### Password and authentication

- Visibility toggles are independent and accessible.
- Registration mismatch blocks submission.
- Reset mismatch blocks submission.
- Editing clears stale mismatch errors.
- Registration payload excludes `confirmPassword`.
- Twelve-character minimum remains enforced.
- Buyer login remains functional.
- Admin login remains functional.
- Forgot-password, verification, and Google sign-in remain unaffected.

### Header and responsive UI

- Bell icon, badge, label, and other actions align.
- Badge counts do not cause layout shift.
- Keyboard focus and active-route state are visible.
- Header remains usable at all specified widths.
- Mobile navigation remains intact below 900px.

### Accessibility

- Keyboard navigation.
- Screen-reader names, roles, states, and error associations.
- Dialog/drawer focus containment and return.
- Reduced-motion behaviour.
- Sufficient target sizes and spacing.
- No colour-only status communication.

## 23. Visual QA protocol

For each target route and width:

1. Capture the baseline before edits.
2. Capture the final result using the same viewport and representative data.
3. Compare typography, alignment, hierarchy, clipping, wrapping, hit areas, focus, loading, empty, error, and success states.
4. Check long product names, long vendor names, large prices, multi-digit badges, missing images, out-of-stock variants, empty tables, and validation errors.
5. Check hover with a mouse, keyboard-only operation, mobile touch layout, and reduced motion.

Do not declare visual completion from a production build alone.

## 24. Required engineering validation

Run the repository-appropriate versions of:

```text
Formatting for changed files
TypeScript/typecheck
Targeted tests during implementation
Full automated test suite
Production build
git diff --check
```

Address new warnings introduced by the work. Document existing unrelated warnings separately instead of hiding them.

## 25. Implementation sequence

Execute in dependency order:

1. Audit current implementation, capture screenshots, and record the requirement matrix.
2. Remove Gateway and implement provider adapters/routing/cooldowns/telemetry.
3. Extend shared proposal services and deterministic assistant behaviour.
4. Update demo fixtures and test-buyer catalogue scope.
5. Improve chat results and proposal UI.
6. Establish UI tokens, typography, spacing, icons, and shared primitives.
7. Tighten the storefront header, product cards, listings, search, and product detail.
8. Tighten dashboard, cart, checkout, account, auth, orders, returns, and sourcing.
9. Tighten the admin shell, dashboard, indexes/tables, forms, media, detail pages, analytics, and settings.
10. Implement PasswordField, header Bell/action structure, and compact desktop behaviour if not already completed during the UI foundation work.
11. Update configuration, readiness checks, launch UI, documentation, and old architecture references.
12. Run automated verification, production build, accessibility checks, and visual QA.
13. Review the final diff for secrets, private data, unintended scope, and stale Gateway references.
14. Commit and push with the PAYDAN GitHub identity when the invocation authorises repository delivery.
15. Apply authorised Vercel environment changes and redeploy.
16. Test Groq, forced OpenRouter failover, and deterministic fallback independently in the deployed environment.

## 26. Deployment configuration

For an authorised production deployment:

1. Verify the active GitHub and Vercel identities belong to PAYDAN.
2. Add the OpenRouter variables to the correct Vercel project and environments.
3. Verify Groq variables and rotate any credential that may have been exposed previously.
4. Remove all Vercel AI Gateway variables.
5. Confirm no tracked file contains real provider credentials.
6. Redeploy from the validated commit.
7. Test Groq success.
8. Force an eligible Groq pre-output failure and verify OpenRouter success.
9. Disable both external providers temporarily in a controlled test and verify deterministic fallback.
10. Restore production configuration and check sanitized logs.

OpenRouter Free and Groq's developer tier are appropriate for QA and controlled demo traffic. Review their current limits, retention, privacy, regional availability, and data policies before enabling real customer conversations. Do not infer production suitability from a successful demo.

## 27. Definition of done

The work is complete only when:

- Vercel AI Gateway dependency, runtime code, configuration, tests, checks, launch UI expectations, and current-architecture documentation are removed.
- Groq, OpenRouter, and deterministic routing follows the exact pre-output failover rules.
- Provider errors never leak to customer messages.
- Catalogue test coverage spans every visible department and test data remains isolated.
- Add, remove, quantity, and clear-cart requests all use owner-bound, expiring, confirmable, cancellable, idempotent proposals.
- Deterministic and external assistants use shared domain services.
- Chat displays catalogue results and proposal states professionally on desktop and mobile.
- Password fields, validation, and Better Auth payload boundaries are correct.
- Header actions and compact desktop behaviour are aligned and accessible.
- Storefront and admin UI use coherent typography, spacing, iconography, controls, tables, states, motion, and responsive behaviour.
- The approved PAYDAN brand and homepage character remain recognisable.
- Guest price privacy, server-side authorization, and payment boundaries remain intact.
- Automated tests, typecheck, production build, and diff checks pass.
- Required routes have been visually reviewed at the specified widths.
- Documentation accurately separates implemented behaviour, local verification, external-service verification, and remaining production configuration.
- The final branch/commit state is reported accurately.

## 28. Final implementation report format

Return a concise report containing:

1. **Implemented:** grouped by provider, assistant/cart, catalogue, authentication/header, storefront UI, and admin UI.
2. **Validated:** exact checks, tests, build, accessibility review, viewport QA, and deployed provider scenarios.
3. **Configuration changed:** variable names and service settings, without values.
4. **External verification remaining:** only genuine credential, account, policy, or production blockers.
5. **Migration/deployment notes:** database, environment, cache, fixture-version, or redeploy steps.
6. **Commit and push:** branch, commit hash, remote sync state, and deployment state.

Do not report a planned item as implemented. Do not report a local fallback as proof that an external provider worked. Do not call the application production-ready while required visual, security, provider, or deployment verification remains incomplete.

---

## Research references for the UI programme

- [Baymard product-list and filtering research](https://baymard.com/research/ecommerce-product-lists): balanced product information, filters, sorting, and category-specific list design.
- [Baymard product-page research](https://baymard.com/research-articles/current-state-ecommerce-product-page-ux): product imagery, variants, purchase confidence, shipping, and return information.
- [Baymard cart and checkout research](https://baymard.com/research/checkout-usability): checkout hierarchy and recovery.
- [Shopify application patterns](https://shopify.dev/docs/api/app-home/latest/patterns): admin landing, index, detail, settings, metrics, and resource-list patterns.
- [Shopify resource-index pattern](https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index): searchable/filterable tables, bulk actions, thumbnails, status, and empty states.
- [Jumia Nigeria](https://www.jumia.com.ng/): Nigerian-market search, category, stock, rating, price, discount, and merchandising conventions. Use as behavioural context, not a visual template.
- [Faire search guidance](https://www.faire.com/support/articles/29979556053787?section=1): marketplace product attributes, brand/vendor context, badges, filters, and fulfilment information.
- [Instacart department-page guidance](https://docs.instacart.com/storefront/pages/department_pages/): item tiles, carousels, and tile-level quantity/cart actions.
- [WCAG 2.2 target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): minimum target size and spacing.
- [WCAG focus appearance guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance): visible, sufficiently contrasted focus indicators.
