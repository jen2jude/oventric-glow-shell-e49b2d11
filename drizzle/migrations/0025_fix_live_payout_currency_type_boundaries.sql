CREATE OR REPLACE FUNCTION public.payout_request_create_live(
  _currency text,
  _amount numeric,
  _fee numeric,
  _net numeric,
  _method text,
  _destination jsonb,
  _recipient_id uuid,
  _recipient_code text,
  _provider text DEFAULT 'paystack'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _bal numeric;
  _new_id uuid;
  _transaction_currency public.wallet_currency;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _currency NOT IN ('NGN','GHS') THEN
    RAISE EXCEPTION 'live payouts only for NGN/GHS';
  END IF;
  IF _method NOT IN ('bank','momo') THEN
    RAISE EXCEPTION 'invalid method';
  END IF;
  IF _provider NOT IN ('paystack','flutterwave') THEN
    RAISE EXCEPTION 'invalid provider';
  END IF;

  _transaction_currency := _currency::public.wallet_currency;

  PERFORM public.assert_no_duplicate_payout(_currency, _amount, _method);
  PERFORM public.consume_withdrawal_pin_verification();

  SELECT available_balance INTO _bal
  FROM public.wallets
  WHERE user_id = _uid
    AND currency = _currency
  FOR UPDATE;

  IF _bal IS NULL OR _bal < _amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
  SET available_balance = available_balance - _amount,
      escrow_balance = escrow_balance + _amount,
      updated_at = now()
  WHERE user_id = _uid
    AND currency = _currency;

  INSERT INTO public.payout_requests(
    user_id, currency, amount, method, destination, status,
    fee_amount, net_amount, recipient_id, paystack_recipient_code,
    provider, provider_recipient_code
  )
  VALUES (
    _uid, _currency, _amount, _method, COALESCE(_destination, '{}'::jsonb), 'pending',
    _fee, _net, _recipient_id,
    CASE WHEN _provider = 'paystack' THEN _recipient_code ELSE NULL END,
    _provider, _recipient_code
  )
  RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(
    user_id, tx_hash, type, amount, currency, inflow, status, occurred_at
  )
  VALUES (
    _uid, 'PYT-' || substr(_new_id::text, 1, 8), 'Payout Withdrawal',
    _amount, _transaction_currency, false, 'pending', now()
  );

  RETURN _new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text, text) TO service_role;