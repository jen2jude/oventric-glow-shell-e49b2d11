-- 1. Close direct-RPC money paths: these must only ever run server-side
--    (service role) or through guarded helpers.
REVOKE EXECUTE ON FUNCTION public.wallet_credit_currency(uuid, numeric, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_debit_currency(uuid, numeric, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reset_wallet(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_campaign(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bounty_publish_lock(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payout_request_create(text, numeric, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payout_request_mark_paid(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payout_request_reject(uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.wallet_credit_currency(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_debit_currency(uuid, numeric, text) TO service_role;

-- 2. Platform revenue reversal (refunds). Mirror of system_wallet_credit,
--    idempotent per (kind, source, ref_id) so a replayed refund cannot
--    debit revenue twice. Service role only.
CREATE OR REPLACE FUNCTION public.system_wallet_debit(
  _kind text,
  _amount numeric,
  _source text,
  _ref uuid DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;

  -- Idempotency: one reversal row per source+ref.
  IF _ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.system_wallet_transactions
    WHERE kind = _kind AND source = _source AND ref_id = _ref
  ) THEN
    RETURN;
  END IF;

  UPDATE public.system_wallets
     SET balance_usd = GREATEST(balance_usd - _amount, 0),
         updated_at = now()
   WHERE kind = _kind;

  INSERT INTO public.system_wallet_transactions (kind, amount_usd, source, ref_id, meta)
    VALUES (_kind, -_amount, _source, _ref, COALESCE(_meta, '{}'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.system_wallet_debit(text, numeric, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_wallet_debit(text, numeric, text, uuid, jsonb) TO service_role;

-- 3. Financial sanity constraints on orders.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_amounts_nonnegative
  CHECK (total_usd >= 0 AND unit_price_usd >= 0 AND display_total >= 0) NOT VALID;