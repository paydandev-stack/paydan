# PAYDAN Admin and Storefront Completion Plan

## 1. Objective

Finish the connection between PAYDAN's operations console and the buyer-facing store, close the operational and data-integrity gaps found in the audit, and prepare the web application for controlled production use.

The completed system should have one authoritative source for catalogue, department, merchandising, customer, order, payment, fulfilment, sourcing, return, support and notification state. Changes made by an authorized staff member should appear in the correct buyer experience without exposing internal records or allowing the UI and server permissions to disagree.

This plan covers the existing Next.js web application. The separate React Native work remains governed by `PAYDAN_REACT_NATIVE_IMPLEMENTATION_PLAN.md`.

## 2. Current baseline

The following capabilities already exist and should be extended rather than replaced:

- PostgreSQL-backed Better Auth with verified email/password and Google OAuth.
- Server-side role checks for the operations console.
- Database-backed products, departments, suppliers, inventory, orders, sourcing, returns, settings, banners and audit records.
- Private S3 media processing and optional CloudFront delivery.
- Paystack initialization, verification, webhooks, reconciliation logic and refunds.
- Durable transactional-email outbox and Resend webhook handling.
- Price-free public catalogue DTOs and member-only price access.
- Ask PAYDAN provider routing, controlled tools and explicit cart proposals.
- A private test-buyer catalogue and history.
- Fifty-five passing automated tests at the time of the audit.

The live deployment responds at `/admin`, but the production catalogue currently contains departments without published products or banners. Support contact data is empty, policies remain marked draft, and search indexing is disabled.

## 3. Completion principles

1. Keep the database authoritative. Do not retain a second hard-coded department, promotion or policy directory where staff expect the admin console to control it.
2. Enforce visibility and permissions on the server. Hiding a button or navigation item is only a UI convenience.
3. Preserve anonymous price privacy in HTML, API payloads, metadata, search and assistant tools.
4. Treat Paystack verification as the authority for payment and refund state.
5. Make background jobs observable and repeat-safe.
6. Isolate demonstration data from all real operational queues, emails and reports.
7. Add pagination before production data volumes grow.
8. Enable public indexing only after catalogue content, policies and contact information are approved.

## 4. Delivery order

| Milestone | Scope                                              | Priority            | Dependency               |
| --------- | -------------------------------------------------- | ------------------- | ------------------------ |
| 0         | Baseline, migration and rollout guardrails         | Critical            | None                     |
| 1         | Department and catalogue authority                 | Critical            | Milestone 0              |
| 2         | Staff roles and admin-control alignment            | Critical            | Milestone 0              |
| 3         | Background jobs, email and payment recovery        | Critical            | Milestone 0              |
| 4         | Exact order-line returns and refunds               | Critical            | Milestone 0              |
| 5         | Merchandising and storefront settings              | High                | Milestone 1              |
| 6         | Test-account isolation                             | High                | Milestones 1–4           |
| 7         | Analytics, audit and operational health            | High                | Milestones 2–4           |
| 8         | Buyer dashboard, notifications and support         | High                | Milestones 1–4           |
| 9         | Product model, search and catalogue scaling        | High                | Milestone 1              |
| 10        | Launch content, indexing and production acceptance | Critical for launch | All preceding milestones |

## 5. Milestone 0 — Baseline and guardrails

### 5.1 Preserve the current state

- Record the current production deployment ID and commit.
- Export a schema-only database backup and confirm Neon restore/PITR settings.
- Capture desktop and mobile screenshots of the storefront, buyer dashboard and all admin sections.
- Record current counts for products, departments, suppliers, inventory, orders, payments, refunds, mail jobs and staff accounts without exporting customer PII.
- Document all external scheduler, webhook and provider-dashboard configuration currently in place.

### 5.2 Migration strategy

- Add versioned SQL migrations for new relational records and indexes.
- Keep migrations forward-compatible with the prior application build until the new build is deployed.
- Backfill new order-line identifiers without changing historical payment totals.
- Mark ambiguous historical return records for manual review instead of guessing their variant.
- Run migrations once using the unpooled Neon connection before deploying code that depends on them.

### 5.3 Required automated baseline

- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- HTTP smoke checks for public routes and anonymous denial of protected APIs.

## 6. Milestone 1 — One department and catalogue authority

### Problem

The homepage maintains its own department list, while the navigation and dashboard use database departments. Department visibility is not applied consistently to products, cart validation and checkout.

### Implementation

1. Remove the `homeDepartments` constant from the homepage.
2. Build every department surface from the authorized `state.categories` payload, sorted by `order`.
3. Render the homepage department cards from the first approved active departments while preserving the approved visual composition. Derive card numbering from sort position and use department-owned display copy/image fields.
4. Extend the department schema with optional merchandising fields if needed:
   - `shortDescription`
   - `image`
   - `homepageVisible`
   - `homepageOrder`
5. Treat archive as the supported removal workflow. A department with existing products should not be hard-deleted from the admin console.
6. Centralize a server helper that determines whether a department/product is visible to a given viewer.
7. Apply that helper in:
   - public catalogue projection;
   - member catalogue projection;
   - product detail lookup;
   - search and Ask PAYDAN tools;
   - cart validation and saved-for-later restoration;
   - checkout quotation and initialization;
   - wishlist and shopping-intent merge;
   - homepage, dashboard and category pages.
8. Prevent publishing a product whose department is archived or restricted incompatibly.
9. When a department is archived, retain historical order lines while preventing new purchases.
10. Invalidate the public catalogue cache after every department or product visibility change.

### Acceptance criteria

- Creating, editing, ordering or archiving a department in admin changes every relevant storefront surface after refresh/cache invalidation.
- An archived department and its products cannot be discovered, added to cart or checked out.
- Historical orders remain readable.
- Anonymous DTOs still contain no prices or supplier data.

## 7. Milestone 2 — Staff roles and visible-control alignment

### Problem

Path access, visible controls and command permissions currently diverge. Some staff members can open an editor whose save action the server rejects.

### Implementation

1. Create a single capability map shared by admin navigation and server authorization. Example capabilities:
   - `catalog.read`, `catalog.write`, `inventory.write`;
   - `departments.write`, `promotions.write`;
   - `vendors.read`, `vendors.write`;
   - `orders.read`, `orders.fulfil`;
   - `customers.read`, `customers.support-note`;
   - `sourcing.read`, `sourcing.write`;
   - `returns.review`, `refunds.issue`;
   - `team.manage`, `settings.manage`, `audit.read`.
2. Map roles to capabilities in one server-owned module.
3. Use the same capability names to filter navigation and disable/hide edit controls.
4. Keep supplier writes with Procurement Managers and Super Admins. Catalog Managers may select existing suppliers while editing a product but should receive a read-only supplier view.
5. Keep customer-support notes with Support and Super Admin unless the client explicitly expands Order Manager authority. Give Order Managers a read-only customer view plus order-specific notes.
6. Make Super Admin-only commands explicit rather than relying on an empty role array convention.
7. Add capability checks to specialized APIs, including inventory, returns, services, support and media.
8. Add a denied-state component that explains the required permission without exposing restricted data.
9. Log role, capability and record type in the audit trail without storing secrets.

### Acceptance criteria

- Every visible write control succeeds for its intended role when given valid data.
- A role cannot call a hidden action directly through an API request.
- Support receives customer-safe order/sourcing data and no supplier costs or private procurement notes.
- The last active Super Admin cannot remove or suspend their own final administrative access.

## 8. Milestone 3 — Background jobs, email and payment recovery

### Problem

The email and payment-reconciliation workers exist, but the checked-in deployment configuration does not schedule them. There is no admin queue showing stuck or dead work.

### Implementation

1. Add a protected payment-reconciliation route, for example `/api/cron/payments`, that invokes the existing reconciliation services without spawning a shell process.
2. Keep `/api/cron/mail` for mail delivery and require `Authorization: Bearer $CRON_SECRET` on both routes.
3. Configure deployment schedules appropriate to the Vercel plan, or document and provision an external scheduler if the required frequency exceeds the plan's cron limits.
4. Recommended target frequencies:
   - mail: every minute;
   - payment/refund reconciliation: every five minutes.
5. Add a distributed job lock or advisory lock so overlapping invocations do not process the same batch.
6. Return sanitized metrics from each run:
   - claimed/checked;
   - sent/verified;
   - failed;
   - suppressed/dead;
   - duration.
7. Add an admin Operations/Jobs page showing:
   - due and dead mail counts;
   - oldest pending message;
   - pending/uncertain payments;
   - refunds awaiting confirmation;
   - last successful worker run;
   - last sanitized failure.
8. Add authorized retry actions for dead mail and reconciliation. A retry must reuse the original event/reference and must not create a duplicate payment, refund or fulfilment event.
9. Alert operations when:
   - a mail reaches its final failed attempt;
   - a payment remains pending beyond the agreed threshold;
   - a refund lacks a provider ID or remains unresolved;
   - a worker has not completed within the expected window.
10. Document Resend webhook events, Paystack webhook URLs and scheduler configuration in the production runbook.

### Acceptance criteria

- A queued verification/order/status email is delivered without manually running a script.
- Duplicate cron calls do not duplicate messages or financial state transitions.
- Pending Paystack transactions are reconciled after browser abandonment.
- Operations can identify and safely retry failed work.

## 9. Milestone 4 — Exact order-line returns and refunds

### Problem

Return requests identify a product but not the exact purchased variant/order line. An order containing two variants of one product can be refunded against the wrong item.

### Implementation

1. Give every order item an immutable `lineId` and retain:
   - `productId`;
   - `variantId`;
   - `variantLabel`;
   - SKU snapshot;
   - unit-price snapshot;
   - quantity.
2. Create new orders with these fields during checkout and sourced-order conversion.
3. Change return creation to require `orderId` and `lineId`.
4. Display variant/SKU details in the customer's return selector and the admin review screen.
5. Calculate already-returned quantity per order line, not per product.
6. Calculate the refund from the exact order-line snapshot and proportional order discount.
7. Backfill old orders with deterministic line IDs. If duplicate historical product lines make a return ambiguous, flag it for staff review and block automatic refund submission.
8. Preserve Paystack verification, idempotency and the rule that approval alone does not mark a refund complete.
9. Add a return timeline visible to the customer without exposing admin notes.

### Acceptance criteria

- Two variants of the same product can be returned independently.
- Total returned quantity cannot exceed the purchased quantity for that line.
- Delivery charges remain excluded unless a future approved policy says otherwise.
- Repeat refund requests do not submit a second Paystack refund.

## 10. Milestone 5 — Merchandising and storefront settings

### Banner and promotion connection

1. Use each hero banner's saved `href` for its CTA.
2. Render supported `side` banner placements in the existing side-card positions. If the design cannot support that placement, remove it from the admin form instead of accepting unused data.
3. Validate banner links as internal storefront paths or an explicit allowlist of HTTPS origins.
4. Require an image, meaningful alt text or a clearly decorative designation.
5. Make schedule boundaries explicit in WAT while storing UTC.
6. Invalidate the public catalogue/home cache on banner changes.

### Storefront settings

1. Correct admin copy that says settings are saved to the browser; they are persisted in PostgreSQL.
2. Connect store name, support email, support phone, business hours and announcement consistently across header, footer, contact, product-support and metadata surfaces.
3. Add validation and a preview for phone/email links.
4. Add optional operational settings for order/support notification recipients without exposing them publicly.

### Merchandising collections

1. Replace positional arrays such as `slice(0, 8)` with explicit rules based on `featured`, `newArrival`, availability and optional collection membership.
2. Add collection ordering to admin if the client needs manual control.
3. Ensure the homepage stays price-free even for signed-in users.

### Acceptance criteria

- Every field exposed by the banner/settings admin has a visible, documented consumer.
- Banner schedule, link and placement behave as shown in preview.
- Homepage sections show intentional collections rather than database insertion order.

## 11. Milestone 6 — Complete test-account isolation

### Problem

The test buyer has private products and history, but some write actions still use real operational record kinds or send real alerts.

### Implementation

1. Create a `ViewerDataScope` helper that resolves `production` or `test:<userId>` once per request.
2. Route every test-buyer operation through scoped record kinds:
   - catalogue and inventory;
   - cart and addresses;
   - orders and returns;
   - sourcing and quotes;
   - support threads;
   - notifications.
3. Suppress external email, Paystack, S3 production prefixes and operations alerts for test-scope actions. Use visibly labelled in-app test events instead.
4. Keep checkout and refunds disabled for test records.
5. Prevent test records from appearing in production admin queues, analytics and customer lists.
6. Add an authorized reset action that restores the test scope to its current fixture version.
7. Display a permanent “Demonstration data” badge in the test buyer experience.

### Acceptance criteria

- No test-buyer action creates a production support, sourcing, return, email, payment or audit record.
- Resetting the test account does not affect production records.
- The test account can demonstrate the complete buyer UI without initiating an external transaction.

## 12. Milestone 7 — Accurate analytics, audit and service health

### Analytics corrections

1. Define and label metrics precisely:
   - gross paid revenue;
   - processed refunds;
   - net revenue;
   - paid order count;
   - pending payment amount;
   - sourcing conversion;
   - return/refund rate.
2. Exclude unpaid, failed and cancelled orders from paid revenue/category revenue.
3. Show refund deductions separately and in net revenue.
4. Base category and supplier analytics on immutable order snapshots.
5. Add date filters and server-side aggregation before production volumes grow.

### Complete audit trail

1. Centralize audit creation in a reusable server service.
2. Audit all meaningful staff writes, including:
   - inventory adjustments;
   - refund submission and verification;
   - support replies;
   - media finalization/deletion;
   - team/role changes;
   - settings, policies and merchandising;
   - worker-initiated payment/refund transitions.
3. Record actor, capability, action, record kind/ID, timestamp and a sanitized before/after summary.
4. Add pagination, filters and detail view to the admin audit page.
5. Define retention and export procedures.

### Connected-service health

1. Split status into `not configured`, `configured`, `verified`, `degraded` and `failing`.
2. Add bounded, side-effect-free checks where supported:
   - PostgreSQL `SELECT 1`;
   - S3 bucket/head permission;
   - SMTP transport verification;
   - Paystack authenticated account/transaction lookup using a safe test reference or provider-supported endpoint;
   - CloudFront URL/signing configuration validation;
   - AI configuration plus an explicit manual test action to avoid accidental spend.
3. Store only check time, latency and sanitized error class.
4. Show environment mode clearly, especially Paystack test versus live.

### Acceptance criteria

- Admin revenue reports reconcile with paid orders and processed refunds.
- Inventory and background financial transitions appear in audit history.
- “Verified” means a recent connectivity check succeeded, not merely that environment variables exist.

## 13. Milestone 8 — Buyer dashboard, notifications and support

### Dashboard completion

Add the planned personalized sections while preserving the current department experience:

1. **Needs attention** — pending payment, quote awaiting response, sourcing update or return update.
2. **Continue shopping** — recently viewed products, stored per customer with a bounded history.
3. **Buy again** — products from delivered orders that remain published and available.
4. **Saved finds** — wishlist items with current availability.
5. **Active order** — latest open order and meaningful next milestone.
6. **Neutral recommendations** — featured/new-arrival products when no history exists.

All recommendation labels must describe the actual rule and must not imply personalization the system does not have.

### In-app notifications

1. Create a durable notification record with owner, type, title, body, route, created/read timestamps and source event key.
2. Generate notifications from the same domain events as email:
   - payment confirmed/failed;
   - order status changed;
   - sourcing quote sent or updated;
   - return/refund status changed;
   - support reply.
3. Add a header badge, notification drawer/page, mark-read and mark-all-read actions.
4. Derive every route server-side and verify ownership again when opened.
5. Keep email preferences separate from essential transactional notices.

### Support conversation

1. Replace the single `reply` field with append-only support messages.
2. Let the customer and authorized staff exchange follow-up messages until resolved.
3. Add ticket status, assignment, timestamps and notification/email events.
4. Preserve customer ownership and staff-safe record projection.

### Acceptance criteria

- The dashboard immediately shows a buyer's most important next action.
- Transaction updates appear in-app and, when enabled, by email.
- Support retains a complete conversation rather than allowing only one reply.

## 14. Milestone 9 — Product model, subcategories and catalogue scaling

### Product and department model

1. Add structured specification editing in the product form.
2. Build variant option editing from department facets, for example size, colour, storage or pack size.
3. Make subcategories editable in department admin and selectable in product admin.
4. Validate SKU uniqueness at the database level.
5. Validate product slug uniqueness with a clear admin error.
6. Add image ordering, alt text, primary-image selection and deletion/orphan cleanup.

### Server-side catalogue queries

1. Add cursor-based pagination for public and member catalogue endpoints.
2. Move search, department, brand, availability, price-band and sort queries to the server.
3. Return only the fields needed by each viewer and surface.
4. Maintain the full-text/trigram index after product writes.
5. Keep public responses CDN-cacheable and member responses private.
6. Update the client listing to retain filter state in the URL and fetch pages incrementally.
7. Add pagination to large admin lists: products, customers, orders, sourcing, audit and mail jobs.

### Acceptance criteria

- A realistic catalogue does not require loading every product into the browser.
- Filter URLs are shareable and recover after navigation.
- Product specifications and variants are editable without hand-editing code.

## 15. Milestone 10 — Launch content and indexing

### Admin launch checklist

Add a Super Admin launch-readiness page showing whether the following are complete:

- at least one active supplier;
- at least one published product with processed image and valid variants;
- confirmed inventory for purchasable variants;
- active delivery zones;
- support email, phone and business hours;
- an active hero/banner or approved fallback;
- approved shipping, returns, privacy and terms policies;
- Google OAuth verified;
- S3/CloudFront verified;
- Paystack test acceptance completed and intended mode selected;
- transactional email and webhooks verified;
- background jobs recently successful;
- AI configuration status clearly shown;
- no unresolved critical operational alerts.

### Policy publishing

1. Move policy content to versioned records with `draft` and `published` status, or retain code-owned content with an explicit business-approval release process.
2. Never expose draft copy as if it were final policy.
3. Record approval date/version and retain prior published versions for order-history reference.

### Search indexing

1. Replace the hard-coded global `noindex, nofollow` with an environment-controlled setting such as `SITE_INDEXING_ENABLED`.
2. Keep preview/staging deployments noindex.
3. Generate `robots.txt` and `sitemap.xml` from published public routes and products.
4. Enable indexing only after the launch checklist passes and the client authorizes public launch.

### Production content population

The client should use the admin portal to add real suppliers, products, inventory, shipping zones, support contacts and merchandising. Do not seed guessed production prices or availability.

### Acceptance criteria

- The launch-readiness page identifies every missing external or content prerequisite.
- Published policy pages no longer carry draft language.
- Production indexing can be enabled independently of preview deployments.
- Search engines receive only public, price-free catalogue content.

## 16. Testing plan

### Unit and service tests

- Department/product visibility helper across guest, member, restricted and archived cases.
- Capability map for every role/action pair.
- Return quantity and refund math by exact order line.
- Analytics calculations for unpaid, paid, partially refunded and fully refunded orders.
- Banner link validation and schedule boundaries.
- Test-scope routing and external-side-effect suppression.

### Database integration tests

- Publishing and archiving departments/products.
- Concurrent inventory, cart, checkout and refund operations.
- Idempotent mail, notification and cron processing.
- Support-thread ownership and staff projection.
- Pagination cursor stability and search-index synchronization.
- Audit creation for specialized API and worker actions.

### Browser tests

- Super Admin complete journey.
- Catalog Manager product/category/inventory journey.
- Procurement supplier/sourcing journey.
- Order Manager fulfilment/return/refund journey.
- Support customer/ticket/return-review journey.
- Guest price-free browsing and sign-in handoff.
- Buyer dashboard attention, recently viewed, buy again and notifications.
- Mobile admin navigation and buyer dashboard layout.

### External staging acceptance

- Google new-account and linked-account sign-in.
- S3 upload, CloudFront public delivery and private evidence denial.
- Paystack success, cancellation, failure, pending recovery, duplicate webhook and verified refund.
- Email verification, reset, order updates, support reply, bounce and complaint suppression.
- Scheduled mail and payment reconciliation.
- Ask PAYDAN catalogue search, member price rules, fallback and cart proposal confirmation.

No live provider test should be marked passed without observing the actual provider response or dashboard event.

## 17. Rollout sequence

1. Merge migrations and backward-compatible server helpers.
2. Deploy to staging and run migration/contract tests.
3. Complete Milestones 1–4 and repeat role/payment/return tests.
4. Configure staging schedulers and validate workers over several cycles.
5. Complete Milestones 5–9 and run the full browser/device matrix.
6. Populate and approve production content through the admin console.
7. Deploy production with indexing still disabled.
8. Run live production smoke checks with test-mode or controlled provider credentials.
9. Monitor errors, queues and reconciliation for an agreed observation period.
10. Enable public indexing only after client approval and the launch checklist passes.

Rollback must preserve financial and mail records. Roll back application code to a compatible build and use forward database fixes; do not automatically reverse payments, refunds, fulfilment or destructive schema changes.

## 18. Definition of done

The admin/storefront completion is finished when:

- every admin-controlled field has a working, documented consumer;
- database departments and catalogue visibility govern all discovery and purchase paths;
- role navigation, controls and server permissions agree;
- workers run automatically and failed work is visible and safely recoverable;
- returns and refunds target exact order lines;
- test-buyer actions cannot enter production operations;
- analytics and audit records accurately reflect real state;
- buyer dashboard, notifications and support conversations satisfy the agreed flow;
- catalogue and admin lists operate with pagination;
- real launch content and approved policies are present;
- external staging acceptance has passed;
- production indexing is enabled only after final business approval.
