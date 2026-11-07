# PAYDAN implementation status

Updated 7 November 2026. This replaces the earlier fixture-only completion report. See `SETUP_AND_OPERATIONS.md` in the application root for configuration and deployment requirements.

The cross-session chronology and Claude/Codex handoff are consolidated in
`docs/CONTEXT_AND_HANDOFF.md`. Use this status file for delivered behavior and
that handoff file for how the different implementation passes connect.

## Implemented

| Area                  | Delivered                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved storefront   | Homepage composition retained, product cards price-free for everyone, technology department corrected, subtle reveals and reduced-motion support                           |
| Public data boundary  | Sanitized anonymous catalogue, dedicated CDN-cacheable price-free payload, no customer/order/vendor records or price/cost fields in public responses                       |
| Identity              | PostgreSQL-backed Better Auth, verified email/password, reset, Google-only OAuth, explicit account linking, real session and role checks                                   |
| Shopping flow         | Dashboard-first sign-in, personal shortcuts, departments and products, expiring validated selection intent and idempotent cart resume                                      |
| Account               | Durable cart, wishlist, addresses, own orders/tracking, sourcing and quotes, returns; private state clears on sign-out/account change                                      |
| Authentication design | Split green/orange layout, Google button, verification and reset pages                                                                                                     |
| Chat                  | Global launcher, desktop expansion/minimize, full-screen mobile focus isolation, owner-specific history, authorized model adapter, explicit cart proposals and shared cart |
| PostgreSQL            | Versioned migrations, owner-indexed records, payment/refund/stock tables, transactions and idempotency receipts                                                            |
| AWS S3/CDN            | Private bucket adapter, constrained uploads, immutable WebP catalog objects, optional direct CloudFront delivery, authorized private attachments                           |
| Paystack              | Server totals, supplier/stock gate, initialization, verification, signed webhooks, duplicate protection, reconciliation, approved return refunds                           |
| Operations            | Server-enforced staff roles, category and shipping creation, inventory, procurement confirmation, returns/refunds, support inbox, configured-service status                |
| Notifications         | Durable email outbox for identity/order/quote/support events, retrying SMTP worker                                                                                         |
| Recovery              | Payment pending/failed/uncertain handling, authoritative total review, validation errors, unavailable-service messages and route error screens                             |
| Handover              | Environment template, setup/runbook, automated commerce tests and HTTP smoke script                                                                                        |

## Verification

The checked-in `tests/commerce.test.ts` suite contains 21 integration/regression cases. It uses PGlite with the real commerce SQL and Better Auth schema/session behavior; payment and model HTTP responses are controlled test fixtures. It covers anonymous/member data boundaries, ownership and role checks, cart validation/idempotency, origin/redirect protection, quote conversion, supplier/stock gates, payment amount/reference verification, signatures, duplicate payment handling, stock release/oversell prevention, CloudFront catalog URL isolation, private media ownership and verified refunds.

Browser checks during implementation covered the public homepage and technology cards, split login page, global chat on authentication pages, honest missing-AI response, mobile full-screen chat, focus isolation/return, and anonymous tracking gate. There is no prior baseline screenshot set, and a full signed-in responsive/browser sweep remains part of staging acceptance.

See `docs/USER_FLOW_REVIEW.md` for the completed flow and its acceptance boundaries. Final command results are recorded there after verification.

## External setup still required

The supplied Neon database in AWS London (`eu-west-2`) was connected and the two versioned PAYDAN migrations plus Better Auth schema were applied on 7 November 2026. No real payment, email, S3 upload, CloudFront distribution or OAuth login was performed. Configure Google, AWS S3/CloudFront, SMTP and Paystack, schedule the workers, then run the staging acceptance checks in the runbook. The AI provider is intentionally unselected; the model adapter is implemented but live chat is unavailable until configured and tested.

Business approval is still needed for real catalogue/stock/shipping data and draft policies. Operational limitations are documented: ambiguous payment/refund submissions require reconciliation; sourced failed payments require team handling; the snapshot architecture is intended for the current catalogue scale. Do not interpret route existence or a successful build as live-service certification.
