-- Expo push fan-out queue. Rows are written alongside durable notification
-- events (same transaction) and consumed by the push worker cron.
CREATE TABLE IF NOT EXISTS push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  event_key text,
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claim_token text,
  sent_at timestamptz,
  dead_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt timestamptz NOT NULL DEFAULT now(),
  last_error text,
  UNIQUE (owner_id, event_key)
);
CREATE INDEX IF NOT EXISTS push_outbox_due
  ON push_outbox (next_attempt) WHERE sent_at IS NULL AND dead_at IS NULL;

-- Per-user opt-out for non-essential push categories. Transactional events
-- (payment, order, sourcing, refund) are always sent when a token exists.
CREATE TABLE IF NOT EXISTS push_opt_out (
  owner_id text NOT NULL,
  category text NOT NULL CHECK (category IN ('marketing', 'sourcing', 'support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, category)
);
