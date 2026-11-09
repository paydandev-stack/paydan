CREATE TABLE IF NOT EXISTS assistant_proposal (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  action text NOT NULL CHECK(action IN ('add_to_cart')),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','confirmed','expired','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz
);
CREATE INDEX IF NOT EXISTS assistant_proposal_owner
  ON assistant_proposal(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assistant_proposal_expiry
  ON assistant_proposal(expires_at) WHERE status = 'pending';
