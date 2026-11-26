ALTER TABLE assistant_proposal
  DROP CONSTRAINT IF EXISTS assistant_proposal_action_check;

ALTER TABLE assistant_proposal
  ADD CONSTRAINT assistant_proposal_action_check
  CHECK(action IN (
    'add_to_cart',
    'remove_cart_line',
    'remove_cart_lines',
    'set_cart_quantity',
    'clear_cart'
  ));

CREATE TABLE IF NOT EXISTS product_review (
  id uuid PRIMARY KEY,
  product_id text NOT NULL,
  owner_id text NOT NULL,
  reviewer_name text NOT NULL,
  order_id text NOT NULL,
  order_line_id text NOT NULL,
  rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title text NOT NULL CHECK(char_length(title) BETWEEN 2 AND 120),
  body text NOT NULL CHECK(char_length(body) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','published','rejected')),
  verified_purchase boolean NOT NULL DEFAULT true,
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  moderated_at timestamptz,
  moderated_by text,
  UNIQUE(owner_id, order_line_id)
);

CREATE INDEX IF NOT EXISTS product_review_published
  ON product_review(product_id, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS product_review_moderation
  ON product_review(status, created_at DESC);

CREATE INDEX IF NOT EXISTS product_review_owner
  ON product_review(owner_id, created_at DESC);
