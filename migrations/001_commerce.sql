CREATE TABLE IF NOT EXISTS commerce_record (
  kind text NOT NULL,
  id text NOT NULL,
  owner_id text,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,id)
);
CREATE INDEX IF NOT EXISTS commerce_owner ON commerce_record(kind,owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_slug ON commerce_record((data->>'slug')) WHERE kind='products';
CREATE UNIQUE INDEX IF NOT EXISTS order_reference ON commerce_record((data->>'reference')) WHERE kind='orders';
CREATE TABLE IF NOT EXISTS command_receipt (
  owner_id text NOT NULL, key text NOT NULL, digest text NOT NULL, result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,key)
);
CREATE TABLE IF NOT EXISTS payment (
  reference text PRIMARY KEY, order_id text UNIQUE NOT NULL, owner_id text NOT NULL,
  amount_kobo bigint NOT NULL CHECK(amount_kobo > 0), currency text NOT NULL CHECK(currency='NGN'),
  email text NOT NULL, status text NOT NULL DEFAULT 'pending', authorization_url text,
  provider_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz
);
CREATE TABLE IF NOT EXISTS webhook_event (
  digest text PRIMARY KEY, event text NOT NULL, processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mail_outbox (
  id text PRIMARY KEY, recipient text NOT NULL, subject text NOT NULL, body text NOT NULL,
  attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_bucket (
  key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id text PRIMARY KEY, owner_id text NOT NULL, object_key text UNIQUE NOT NULL,
  purpose text NOT NULL CHECK(purpose IN ('catalog','sourcing','return')),
  mime text NOT NULL, size integer NOT NULL CHECK(size BETWEEN 1 AND 5242880),
  status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS refund (
  id text PRIMARY KEY, order_id text NOT NULL, return_id text UNIQUE NOT NULL,
  amount_kobo bigint NOT NULL CHECK(amount_kobo > 0), status text NOT NULL DEFAULT 'requested',
  provider_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
