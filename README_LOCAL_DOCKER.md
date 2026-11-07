# Local Docker (prod-like) setup

This runs the full stack locally: Next.js app + PostgreSQL + MinIO (S3-compatible) + Mailpit (SMTP capture) + background workers.

## Prerequisites

- Docker Desktop / Docker Engine with Compose

## Start

```powershell
# Create the private local environment file from the committed template:
Copy-Item .env.docker.example .env.docker

docker compose up --build -d
```

Compose loads the private `.env.docker` file automatically. It is gitignored;
do not commit real credentials. To use another private file, set
`PAYDAN_ENV_FILE` to its path before starting Compose.

The app container runs migrations, loads the safe sample catalogue into an empty
local database, creates test inventory, activates the Lagos delivery zone, and
creates the two verified local accounts on startup. These seeds are guarded by
`ALLOW_LOCAL_SEED=true` and are intended only for this local stack.

## Refresh test users (optional)

```bash
docker compose exec app npm run db:seed:users
```

Default local test accounts (change via `.env.docker` / env vars before seeding):

- **Buyer:** `buyer@paydan.local` / `PaydanBuyer123!`
- **Admin (Super Admin):** `admin@paydan.local` / `PaydanAdmin123!`

## URLs

- App: http://localhost:3000
- Buyer dashboard (after login): http://localhost:3000/dashboard
- MinIO console: http://localhost:9001 (minioadmin / minioadmin123)
- Mailpit (captured emails): http://localhost:8025

## Notes

- Google OAuth, Paystack, and AI are not configured by default. Email/password sign-in works with the seeded verified users.
- The payment reconciliation worker is disabled until a Paystack test key is configured. Start it with `docker compose --profile payments up -d payment-worker` after adding the key to the active environment file.
- `docker-compose.yml` uses `env_file: .env.docker`. Create it from `.env.docker.example`, then keep real secrets only in the gitignored copy.
- Media uploads use MinIO via `S3_ENDPOINT` (container) and `S3_PUBLIC_ENDPOINT` (browser).
