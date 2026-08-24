ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.oventric_slugify(_txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_txt, '')), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.products_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := left(public.oventric_slugify(NEW.name), 60);
    IF base = '' THEN base := 'item'; END IF;
    NEW.slug := base || '-' || left(replace(NEW.id::text, '-', ''), 6);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_set_slug ON public.products;
CREATE TRIGGER trg_products_set_slug
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_set_slug();

UPDATE public.products
SET slug = left(nullif(public.oventric_slugify(name), ''), 60) || '-' || left(replace(id::text, '-', ''), 6)
WHERE slug IS NULL OR slug = '';

UPDATE public.products
SET slug = 'item-' || left(replace(id::text, '-', ''), 6)
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug);