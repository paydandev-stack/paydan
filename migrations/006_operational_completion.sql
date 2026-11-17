CREATE UNIQUE INDEX IF NOT EXISTS product_sku
  ON commerce_record(lower(data->>'sku'))
  WHERE kind='products' AND COALESCE(data->>'sku','') <> '';

-- Every catalogue SKU, including variant SKUs, is protected by a relational
-- unique constraint. The trigger keeps this projection in step with the JSON
-- product record, so concurrent admin writes cannot race past application
-- validation.
CREATE TABLE IF NOT EXISTS catalog_sku (
  sku text PRIMARY KEY,
  product_id text NOT NULL,
  variant_id text,
  UNIQUE(product_id, variant_id)
);

CREATE OR REPLACE FUNCTION sync_catalog_skus() RETURNS trigger AS $$
DECLARE
  variant jsonb;
  normalized text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.kind = 'products' THEN
      DELETE FROM catalog_sku WHERE product_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.kind <> 'products' THEN
    IF TG_OP = 'UPDATE' AND OLD.kind = 'products' THEN
      DELETE FROM catalog_sku WHERE product_id = OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  DELETE FROM catalog_sku WHERE product_id = NEW.id;
  normalized := lower(trim(COALESCE(NEW.data->>'sku', '')));
  IF normalized <> '' THEN
    INSERT INTO catalog_sku(sku, product_id, variant_id)
    VALUES(normalized, NEW.id, NULL);
  END IF;

  FOR variant IN
    SELECT value FROM jsonb_array_elements(COALESCE(NEW.data->'variants', '[]'::jsonb))
  LOOP
    normalized := lower(trim(COALESCE(variant->>'sku', '')));
    IF normalized <> '' THEN
      INSERT INTO catalog_sku(sku, product_id, variant_id)
      VALUES(normalized, NEW.id, variant->>'id');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commerce_catalog_sku_sync ON commerce_record;
CREATE TRIGGER commerce_catalog_sku_sync
AFTER INSERT OR UPDATE OR DELETE ON commerce_record
FOR EACH ROW EXECUTE FUNCTION sync_catalog_skus();

INSERT INTO catalog_sku(sku, product_id, variant_id)
SELECT lower(trim(data->>'sku')), id, NULL
FROM commerce_record
WHERE kind='products' AND trim(COALESCE(data->>'sku','')) <> ''
ON CONFLICT (sku) DO NOTHING;

INSERT INTO catalog_sku(sku, product_id, variant_id)
SELECT lower(trim(variant->>'sku')), product.id, variant->>'id'
FROM commerce_record product
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(product.data->'variants','[]'::jsonb)) variant
WHERE product.kind='products' AND trim(COALESCE(variant->>'sku','')) <> ''
ON CONFLICT (sku) DO NOTHING;

CREATE INDEX IF NOT EXISTS commerce_kind_updated
  ON commerce_record(kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_owner_updated
  ON commerce_record(kind, owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS product_category_status
  ON commerce_record((data->>'categorySlug'), (data->>'status'))
  WHERE kind='products';

-- Older orders receive stable line identifiers without touching price or
-- payment snapshots. Returns that still lack a selected line remain subject to
-- the application's manual-review guard.
UPDATE commerce_record order_record
SET data = jsonb_set(
  order_record.data,
  '{items}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN item.value ? 'lineId' THEN item.value
          ELSE item.value || jsonb_build_object(
            'lineId',
            'legacy-' || md5(order_record.id || ':' || item.ordinality::text)
          )
        END
        ORDER BY item.ordinality
      )
      FROM jsonb_array_elements(COALESCE(order_record.data->'items','[]'::jsonb))
        WITH ORDINALITY AS item(value, ordinality)
    ),
    '[]'::jsonb
  )
)
WHERE order_record.kind='orders'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(order_record.data->'items','[]'::jsonb)) value
    WHERE NOT (value ? 'lineId')
  );

ALTER TABLE refund ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE refund ADD COLUMN IF NOT EXISTS last_error text;

CREATE TABLE IF NOT EXISTS worker_run (
  id uuid PRIMARY KEY,
  worker text NOT NULL CHECK(worker IN ('mail','payments','media')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','succeeded','failed')),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_class text
);
ALTER TABLE worker_run DROP CONSTRAINT IF EXISTS worker_run_worker_check;
ALTER TABLE worker_run ADD CONSTRAINT worker_run_worker_check
  CHECK(worker IN ('mail','payments','media'));
CREATE INDEX IF NOT EXISTS worker_run_latest ON worker_run(worker, started_at DESC);

CREATE TABLE IF NOT EXISTS notification (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL,
  source_event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE(owner_id, source_event_key)
);
CREATE INDEX IF NOT EXISTS notification_owner
  ON notification(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_thread (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','waiting_on_customer','waiting_on_staff','resolved')),
  assignee text,
  test_scope boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_thread_owner
  ON support_thread(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_thread_queue
  ON support_thread(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_message (
  id uuid PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES support_thread(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  author_type text NOT NULL CHECK(author_type IN ('customer','staff')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_message_thread
  ON support_message(thread_id, created_at);
