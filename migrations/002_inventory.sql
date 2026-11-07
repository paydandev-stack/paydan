CREATE TABLE IF NOT EXISTS inventory (
  product_id text NOT NULL, variant_id text NOT NULL, available integer NOT NULL CHECK(available>=0),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(product_id,variant_id)
);
CREATE TABLE IF NOT EXISTS inventory_reservation (
  order_id text NOT NULL, product_id text NOT NULL, variant_id text NOT NULL,
  quantity integer NOT NULL CHECK(quantity>0), status text NOT NULL DEFAULT 'reserved',
  PRIMARY KEY(order_id,product_id,variant_id)
);
