ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS event_key text;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'customer';
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS template_key text;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS template_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS html text;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS reply_to text;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS claim_token uuid;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS delayed_at timestamptz;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS bounced_at timestamptz;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS complained_at timestamptz;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS dead_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS mail_outbox_event_key
  ON mail_outbox(event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS mail_outbox_due
  ON mail_outbox(next_attempt, created_at)
  WHERE sent_at IS NULL AND dead_at IS NULL;
CREATE INDEX IF NOT EXISTS mail_outbox_provider_message
  ON mail_outbox(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_webhook_event (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_suppression (
  recipient text PRIMARY KEY,
  reason text NOT NULL CHECK(reason IN ('bounce','complaint')),
  created_at timestamptz NOT NULL DEFAULT now()
);
