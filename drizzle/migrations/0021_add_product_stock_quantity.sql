ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity integer;
COMMENT ON COLUMN public.products.stock_quantity IS 'Units available for this listing. NULL means unlimited.';
GRANT SELECT (stock_quantity) ON public.products TO anon;
GRANT SELECT (stock_quantity), INSERT (stock_quantity), UPDATE (stock_quantity) ON public.products TO authenticated;