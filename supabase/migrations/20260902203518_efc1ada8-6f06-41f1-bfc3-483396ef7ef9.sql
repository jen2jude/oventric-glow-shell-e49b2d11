CREATE OR REPLACE FUNCTION public.payout_request_create_usd(
  _usd_amount numeric,
  _source_currency text,
  _source_amount numeric,
  _channel text,
  _destination jsonb
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
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _usd_amount IS NULL OR _usd_amount <= 0 OR _source_amount IS NULL OR _source_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _channel NOT IN ('binance','bybit','minipay','wallet') THEN
    RAISE EXCEPTION 'invalid channel';
  END IF;

  SELECT available_balance INTO _bal
  FROM public.wallets
  WHERE user_id = _uid AND currency = _source_currency
  FOR UPDATE;

  IF _bal IS NULL OR _bal < _source_amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
  SET available_balance = available_balance - _source_amount,
      escrow_balance = escrow_balance + _source_amount,
      updated_at = now()
  WHERE user_id = _uid AND currency = _source_currency;

  INSERT INTO public.payout_requests(user_id, currency, amount, method, destination, status)
  VALUES (
    _uid,
    'USD',
    _usd_amount,
    'wire',
    COALESCE(_destination, '{}'::jsonb) || jsonb_build_object(
      'channel', _channel,
      'source_currency', _source_currency,
      'source_amount', _source_amount
    ),
    'pending'
  )
  RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
  VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _source_amount, _source_currency::public.wallet_currency, false, 'pending', now());

  RETURN _new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.payout_request_create_usd(numeric, text, numeric, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.payout_request_create_usd(numeric, text, numeric, text, jsonb) TO authenticated, service_role;