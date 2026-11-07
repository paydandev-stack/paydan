# PAYDAN user flow review

Updated 5 November 2026.

## Guest to customer

Visitors browse the approved home page without prices. Public listings and product details explain products and departments without exposing monetary/internal records. Purchasing asks for sign-in. A validated product/variant/quantity intent can survive login or email verification for 24 hours; sourcing form drafts remain local until signed-in submission.

Email verification or Google sign-in establishes a server session. Successful login lands on `/dashboard`, where personal shortcuts sit alongside departments and product listings. The pending selection is offered for confirmation and merged into the persistent cart once. `/account` redirects to the dashboard; order, profile, address and wishlist routes remain available.

Checkout collects delivery details, obtains server-calculated stock/price/shipping/promotion totals, and requires review before Paystack. Provider verification determines success. A return URL alone never proves payment. Pending/failed states preserve a route back to the order/cart. Tracking and customer shipment groups never disclose supplier details or other customers' orders.

## Sourcing and returns

A signed-in sourcing request can include private image evidence. Procurement prepares and sends a quote; the customer accepts it. Conversion creates an unpaid order. Supplier confirmation records actual availability/costs before delivery review and Paystack payment become available. No invented supplier margin is used.

Returns refer to the customer's delivered, paid order and remaining returnable quantities. Staff review each request. Authorized payment operators issue an approved refund through Paystack and verify its outcome. Refund approval and completed refund are separate states.

## Assistant

The launcher remains available throughout application pages, including authentication, customer and admin routes. The panel expands/minimizes on desktop and isolates focus full-screen on mobile. Guest access supports public catalogue discovery and sign-in handoff. Member access adds authorized prices, own-order status and proposed cart additions. Each mutation is confirmed and uses the same server cart/idempotency rules as the UI. Checkout and payment stay in the reviewed checkout flow.

The provider remains undecided. Missing configuration produces an honest unavailable message. No live model behavior has been certified.

## Staff

Only active roles attached to verified accounts grant access. Catalog staff manage products and inventory; procurement handles suppliers and sourcing; order managers handle fulfillment/refunds; Support sees customer-safe order/sourcing details and reviews returns/tickets. Super Admin manages team access and settings. Server APIs enforce these rules independently of navigation visibility.

## Verification record

Final build/typecheck/test/smoke results are appended after execution. Browser observations: homepage price-free; technology section contains devices; login split layout renders; mobile chat fits 390×844 and returns focus to its launcher; anonymous tracking shows a sign-in gate. Member browser journeys and live integrations require a configured staging environment. No before/after homepage baseline comparison is claimed.
