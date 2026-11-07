# Local development (Docker, prod-like)

## Where the previous Codex/Claude pass stopped

Based on `docs/implementation-progress.md`, `SETUP_AND_OPERATIONS.md`, and the pasted Codex audit:

- **Done/in progress (code present):** storefront hardening, server-backed auth/store/commands, `/dashboard` route + intent resume, checkout/payment/media/assistant foundations, admin areas, migrations, workers, and tests.
- **Stopped / incomplete at handoff:** no local production-like runtime wiring committed (Docker/MinIO/Mailpit), no seeded test users for quick QA, and external integrations (real Postgres in use, Google OAuth credentials, AWS S3, SMTP, Paystack, AI provider) not configured/verified end-to-end. The Codex run ended after hitting usage limits while finishing operations/tests/docs and smoke checks.

## Priorities completed in this pass

1. **Buyer dashboard:** `/dashboard` is the post-login landing (auth form redirects to `/dashboard`; `/account` redirects to `/dashboard`). The header account link for signed-in users points to `/dashboard`. Dashboard shows welcome/personal shortcuts, intent resume, departments, and member-priced products (using server snapshot data via the store).
2. **Seeded test users:** `npm run db:seed:users` (or in Docker: `docker compose exec app npm run db:seed:users`) creates/updates **verified** Better Auth email/password users and links admin access for the admin test account. Defaults (override via env): `buyer@paydan.local` / `PaydanBuyer123!`, `admin@paydan.local` / `PaydanAdmin123!`.
3. **Docker local stack (prod-like):** `docker-compose.yml` + `Dockerfile` + `.env.docker` run Postgres, MinIO (S3-compatible), Mailpit, the app, and the mail worker. `src/server/media.ts` supports `S3_ENDPOINT`/`S3_PUBLIC_ENDPOINT`/`S3_FORCE_PATH_STYLE` for MinIO. The app container fails closed on migration/bootstrap errors, then starts with the safe catalogue, local stock, an active Lagos delivery zone, and both verified local accounts. The Paystack reconciliation worker is an opt-in Compose profile until a test key is configured.

## Run

```powershell
docker compose up --build -d
docker compose exec app npm run db:seed:users # optional idempotent refresh
```

For private overrides, copy `.env.docker` to the ignored
`.env.docker.local`, set `$env:PAYDAN_ENV_FILE = ".env.docker.local"`, then
run Compose. This changes the file injected into each container; `--env-file`
alone only changes Compose variable interpolation.
Open http://localhost:3000 and sign in at `/login`.

## Still unfinished (next work)

- Run full end-to-end verification against the Docker stack (signup/verify/reset flows with Mailpit, cart/checkout, Paystack test mode, S3 upload/download, admin role flows).
- Complete/verify the remaining audit items (public tracking/data-boundary edge cases, sourcing/quote/return/refund operational polish, promotions in checkout, category/admin gaps, conversational cart tool execution quality, responsive/mobile QA, homepage motion/accessibility polish).
- Configure real Google OAuth, Paystack test/live keys, production S3/SMTP, and choose/configure an AI provider; add deployment/rollback runbooks and stronger integration tests against real services.
