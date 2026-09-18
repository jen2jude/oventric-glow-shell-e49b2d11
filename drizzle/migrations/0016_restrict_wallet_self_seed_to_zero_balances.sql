DROP POLICY IF EXISTS "user can seed own wallets" ON public.wallets;

CREATE POLICY "user can seed own zero-balance wallet"
ON public.wallets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false
  AND COALESCE(available_balance, 0) = 0
  AND COALESCE(escrow_balance, 0) = 0
  AND COALESCE(accumulated_cashback, 0) = 0
  AND COALESCE(bounty_balance, 0) = 0
);