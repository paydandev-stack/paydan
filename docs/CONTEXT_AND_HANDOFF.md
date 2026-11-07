# PAYDAN context and handoff

Updated 6 November 2026. This document links the planning, implementation,
Claude handoff, and current local-runtime work into one source of truth.

## How the work connects

1. `PAYDAN_Consolidated_Plan.md` is the product and technical target. The
   companion `CLAUDE_PAYDAN_Implementation_Prompt.md` translates that target
   into implementation instructions.
2. The first expanded UI pass supplied broad storefront, account, chat, and
   admin screens, but relied on browser-local demo state and placeholders.
3. The 5 November implementation pass replaced those boundaries with
   PostgreSQL-backed authentication and commerce state, private media handling,
   Paystack verification/refunds, an authorized AI adapter, durable email jobs,
   staff roles, tests, and operational documentation. The historical audit that
   described `/dashboard`, authentication, database, S3, and Paystack as missing
   is therefore superseded by `implementation-progress.md`.
4. Claude then added the local Docker stack, verified buyer/admin seed accounts,
   MinIO endpoint support, and the signed-in header link to `/dashboard`. That
   pass stopped before the Docker engine could run, so the stack had not been
   booted or tested.
5. The current cleanup corrected the Docker seed guards and restart behavior,
   made local bootstrap idempotent, added local inventory and an active Lagos
   delivery zone, made migration failures stop startup, added app health checks,
   kept the Paystack worker opt-in until a test key exists, tightened restricted
   category snapshots, and removed stale customer-facing demo/supplier copy.

## Current documents

| Document                         | Purpose                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `../PAYDAN_Consolidated_Plan.md` | Approved product, UX, data, payment, assistant, and delivery plan            |
| `implementation-progress.md`     | Delivered code and evidence, plus remaining external acceptance work         |
| `USER_FLOW_REVIEW.md`            | Guest, member, sourcing, returns, assistant, and staff flow review           |
| `LOCAL_DEV.md`                   | Docker/seeded-account setup and current local-runtime verification status    |
| `../SETUP_AND_OPERATIONS.md`     | Production provider setup, workers, monitoring, backup, and rollback runbook |
| `../README_LOCAL_DOCKER.md`      | Short local-stack quick start                                                |

## Current boundaries

The application code and automated checks are complete for the selected
architecture. Google OAuth, real AWS S3, SMTP delivery, Paystack test/live, and
an AI provider still require external credentials and staging acceptance. The
local stack uses MinIO and Mailpit so storage and mail behavior can be exercised
without production accounts. Paystack is never simulated as successful.

Current policy pages remain draft business copy. Catalogue prices, inventory,
shipping fees, supplier data, support contacts, and return terms must be replaced
with approved operational data before launch.

## Test accounts for the local stack

- Buyer: `buyer@paydan.local` / `PaydanBuyer123!`
- Super Admin: `admin@paydan.local` / `PaydanAdmin123!`

These credentials exist only after the guarded local Docker bootstrap and must
never be used in staging or production.
