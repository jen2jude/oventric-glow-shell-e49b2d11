ALTER TABLE public.creator_posts
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS creator_posts_product_id_idx ON public.creator_posts(product_id);