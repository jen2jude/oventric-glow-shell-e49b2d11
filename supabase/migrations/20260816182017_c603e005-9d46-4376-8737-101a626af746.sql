ALTER TABLE public.products ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;
GRANT SELECT (in_stock) ON public.products TO anon, authenticated;
GRANT UPDATE (in_stock) ON public.products TO authenticated;