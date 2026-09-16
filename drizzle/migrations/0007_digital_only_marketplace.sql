-- The platform is digital-only. Physical listings and physical categories have
-- been removed; these constraints stop either from being created again.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_kind_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_kind_check CHECK (kind = ANY (ARRAY['digital'::text, 'service'::text]));

ALTER TABLE public.marketplace_categories DROP CONSTRAINT IF EXISTS marketplace_categories_kind_check;
ALTER TABLE public.marketplace_categories
  ADD CONSTRAINT marketplace_categories_kind_check CHECK (kind = 'digital'::text);

ALTER TABLE public.marketplace_categories ALTER COLUMN kind SET DEFAULT 'digital';