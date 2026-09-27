CREATE TABLE public.seller_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  product_id uuid,
  kind text NOT NULL,
  viewer_key text NOT NULL,
  viewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_view_events TO authenticated;
GRANT ALL ON public.seller_view_events TO service_role;
ALTER TABLE public.seller_view_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers read own view events" ON public.seller_view_events FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE INDEX seller_view_events_seller_idx ON public.seller_view_events (seller_id, kind, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_seller_view(_seller_id uuid, _product_id uuid, _kind text, _viewer_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _key text;
BEGIN
  IF _kind NOT IN ('shop_visit','product_view') OR _seller_id IS NULL THEN RETURN; END IF;
  IF _uid IS NOT NULL AND _uid = _seller_id THEN RETURN; END IF;
  _key := left(coalesce(_uid::text, nullif(trim(_viewer_key), ''), 'anon'), 64);
  -- one count per viewer per target per 30 minutes
  IF EXISTS (SELECT 1 FROM seller_view_events WHERE seller_id = _seller_id AND kind = _kind
     AND product_id IS NOT DISTINCT FROM _product_id AND viewer_key = _key
     AND created_at > now() - interval '30 minutes') THEN RETURN; END IF;
  INSERT INTO seller_view_events (seller_id, product_id, kind, viewer_key, viewer_id)
  VALUES (_seller_id, _product_id, _kind, _key, _uid);
END $$;
GRANT EXECUTE ON FUNCTION public.log_seller_view(uuid, uuid, text, text) TO anon, authenticated;