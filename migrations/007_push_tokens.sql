-- Expo push-token registry: one row per (user, device, environment).
-- Tokens are replaced on re-registration and removed on sign-out or
-- provider "DeviceNotRegistered" receipts. No secrets stored here.
CREATE TABLE IF NOT EXISTS push_token (
  owner_id text NOT NULL,
  device_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  app_environment text NOT NULL CHECK (app_environment IN ('development', 'preview', 'production')),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, device_id, app_environment)
);
CREATE INDEX IF NOT EXISTS push_token_owner
  ON push_token (owner_id, app_environment);
