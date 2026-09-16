-- Stage 5 hardening.

-- 1. One ledger posting per authoritative reference. Settlement, refunds,
--    cashback and referral rewards all stamp a deterministic tx_hash, so a
--    replayed event can no longer post a second row.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_tx_hash_key
  ON public.wallet_transactions (tx_hash)
  WHERE tx_hash IS NOT NULL;

-- 2. Reviews must be backed by a real settled purchase of that product.
CREATE OR REPLACE FUNCTION public.has_purchased_product(_user_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.buyer_id = _user_id
      AND o.product_id = _product_id
      AND o.status = 'paid'
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_purchased_product(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can add their own review" ON public.product_reviews;
CREATE POLICY "Buyers review products they purchased"
ON public.product_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.has_purchased_product(auth.uid(), product_id)
);

DROP POLICY IF EXISTS "Users can update their own review" ON public.product_reviews;
CREATE POLICY "Buyers update their own review"
ON public.product_reviews
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
)
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.has_purchased_product(auth.uid(), product_id)
);