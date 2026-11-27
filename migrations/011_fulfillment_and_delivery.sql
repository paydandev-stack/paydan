CREATE TABLE IF NOT EXISTS vendor_fulfillment_location (
  id text PRIMARY KEY,
  vendor_id text NOT NULL,
  label text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  latitude double precision,
  longitude double precision,
  is_primary boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  pickup_available boolean NOT NULL DEFAULT false,
  dispatch_lead_time_days integer NOT NULL DEFAULT 0 CHECK(dispatch_lead_time_days BETWEEN 0 AND 365),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_fulfillment_location_vendor
  ON vendor_fulfillment_location(vendor_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_one_primary_location
  ON vendor_fulfillment_location(vendor_id) WHERE is_primary AND active;

INSERT INTO vendor_fulfillment_location(
  id,vendor_id,label,address,city,state,is_primary,active,pickup_available,dispatch_lead_time_days
)
SELECT
  vendor.id || '-primary', vendor.id, 'Primary fulfilment location',
  COALESCE(vendor.data->>'address',''), COALESCE(vendor.data->>'city',''),
  COALESCE(vendor.data->>'state',''), true, true, false,
  GREATEST(
    0,
    LEAST(
      365,
      CASE
        WHEN COALESCE(vendor.data->>'leadTimeDays','') ~ '^[0-9]+$'
          THEN (vendor.data->>'leadTimeDays')::integer
        ELSE 0
      END
    )
  )
FROM commerce_record vendor
WHERE vendor.kind='vendors'
ON CONFLICT(id) DO NOTHING;

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS fulfillment_location_id text;
UPDATE inventory stock
SET fulfillment_location_id = COALESCE(
  (
    SELECT product.data->>'vendorId' || '-primary'
    FROM commerce_record product
    WHERE product.kind='products' AND product.id=stock.product_id
  ),
  'legacy-primary'
)
WHERE fulfillment_location_id IS NULL;
ALTER TABLE inventory ALTER COLUMN fulfillment_location_id SET DEFAULT 'legacy-primary';
ALTER TABLE inventory ALTER COLUMN fulfillment_location_id SET NOT NULL;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_pkey;
ALTER TABLE inventory ADD PRIMARY KEY(product_id,variant_id,fulfillment_location_id);

ALTER TABLE inventory_reservation ADD COLUMN IF NOT EXISTS fulfillment_location_id text;
UPDATE inventory_reservation reservation
SET fulfillment_location_id = COALESCE(
  (
    SELECT stock.fulfillment_location_id
    FROM inventory stock
    WHERE stock.product_id=reservation.product_id
      AND stock.variant_id=reservation.variant_id
    ORDER BY stock.available DESC
    LIMIT 1
  ),
  'legacy-primary'
)
WHERE fulfillment_location_id IS NULL;
ALTER TABLE inventory_reservation ALTER COLUMN fulfillment_location_id SET DEFAULT 'legacy-primary';
ALTER TABLE inventory_reservation ALTER COLUMN fulfillment_location_id SET NOT NULL;
ALTER TABLE inventory_reservation DROP CONSTRAINT IF EXISTS inventory_reservation_pkey;
ALTER TABLE inventory_reservation ADD PRIMARY KEY(
  order_id,product_id,variant_id,fulfillment_location_id
);

CREATE TABLE IF NOT EXISTS delivery_band (
  id text PRIMARY KEY,
  label text NOT NULL,
  fee numeric(14,2) NOT NULL CHECK(fee >= 0),
  transit_days_min integer NOT NULL CHECK(transit_days_min >= 0),
  transit_days_max integer NOT NULL CHECK(transit_days_max >= transit_days_min),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
