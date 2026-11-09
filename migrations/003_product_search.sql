CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS product_search (
  product_id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  category_slug text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  search_text text NOT NULL,
  search_document tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', search_text)
  ) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_search_fts
  ON product_search USING gin(search_document);
CREATE INDEX IF NOT EXISTS product_search_trgm
  ON product_search USING gin(search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_search_category
  ON product_search(category_slug);

CREATE OR REPLACE FUNCTION sync_product_search() RETURNS trigger AS $$
DECLARE
  value jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.kind = 'products' THEN
      DELETE FROM product_search WHERE product_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.kind <> 'products' THEN
    IF OLD.kind = 'products' THEN
      DELETE FROM product_search WHERE product_id = OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  value := NEW.data;
  IF COALESCE(value->>'status', '') <> 'published'
     OR COALESCE((value->>'restricted')::boolean, false) THEN
    DELETE FROM product_search WHERE product_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO product_search(
    product_id, slug, name, brand, category_slug, description, search_text, updated_at
  ) VALUES (
    NEW.id,
    COALESCE(value->>'slug', NEW.id),
    COALESCE(value->>'name', ''),
    COALESCE(value->>'brand', ''),
    COALESCE(value->>'categorySlug', ''),
    COALESCE(value->>'description', ''),
    concat_ws(' ',
      value->>'name', value->>'brand', value->>'description', value->>'categorySlug',
      (SELECT string_agg(entry, ' ') FROM jsonb_array_elements_text(COALESCE(value->'highlights', '[]'::jsonb)) AS entry),
      (SELECT string_agg(key || ' ' || val, ' ') FROM jsonb_each_text(COALESCE(value->'specifications', '{}'::jsonb)) AS spec(key, val))
    ),
    now()
  ) ON CONFLICT(product_id) DO UPDATE SET
    slug = excluded.slug,
    name = excluded.name,
    brand = excluded.brand,
    category_slug = excluded.category_slug,
    description = excluded.description,
    search_text = excluded.search_text,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commerce_product_search_sync ON commerce_record;
CREATE TRIGGER commerce_product_search_sync
AFTER INSERT OR UPDATE OR DELETE ON commerce_record
FOR EACH ROW EXECUTE FUNCTION sync_product_search();

INSERT INTO product_search(product_id, slug, name, brand, category_slug, description, search_text, updated_at)
SELECT
  id,
  COALESCE(data->>'slug', id),
  COALESCE(data->>'name', ''),
  COALESCE(data->>'brand', ''),
  COALESCE(data->>'categorySlug', ''),
  COALESCE(data->>'description', ''),
  concat_ws(' ',
    data->>'name', data->>'brand', data->>'description', data->>'categorySlug',
    (SELECT string_agg(entry, ' ') FROM jsonb_array_elements_text(COALESCE(data->'highlights', '[]'::jsonb)) AS entry),
    (SELECT string_agg(key || ' ' || val, ' ') FROM jsonb_each_text(COALESCE(data->'specifications', '{}'::jsonb)) AS spec(key, val))
  ),
  updated_at
FROM commerce_record
WHERE kind = 'products'
  AND COALESCE(data->>'status', '') = 'published'
  AND NOT COALESCE((data->>'restricted')::boolean, false)
ON CONFLICT(product_id) DO UPDATE SET
  slug = excluded.slug,
  name = excluded.name,
  brand = excluded.brand,
  category_slug = excluded.category_slug,
  description = excluded.description,
  search_text = excluded.search_text,
  updated_at = excluded.updated_at;
