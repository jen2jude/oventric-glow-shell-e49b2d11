ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS seller_reply TEXT,
  ADD COLUMN IF NOT EXISTS seller_reply_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.reply_to_product_review(_review_id uuid, _reply text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seller uuid;
  _product uuid;
  _buyer uuid;
  _pname text;
  _txt text := nullif(btrim(coalesce(_reply, '')), '');
BEGIN
  SELECT r.product_id, r.user_id, p.seller_id, p.name
    INTO _product, _buyer, _seller, _pname
  FROM public.product_reviews r
  JOIN public.products p ON p.id = r.product_id
  WHERE r.id = _review_id;

  IF _product IS NULL THEN
    RAISE EXCEPTION 'Review not found';
  END IF;
  IF _seller IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the seller of this product can reply';
  END IF;

  UPDATE public.product_reviews
     SET seller_reply = _txt,
         seller_reply_at = CASE WHEN _txt IS NULL THEN NULL ELSE now() END
   WHERE id = _review_id;

  IF _txt IS NOT NULL AND _buyer IS DISTINCT FROM _seller THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (
      _buyer,
      'product_review',
      'Seller replied to your review',
      left(_txt, 160),
      '/product/' || _product::text || '#reviews'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reply_to_product_review(uuid, text) TO authenticated;