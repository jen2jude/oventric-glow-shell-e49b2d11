-- 1. Track server-side PIN verification so payout creation can require it.
ALTER TABLE public.withdrawal_pins
  ADD COLUMN IF NOT EXISTS pin_verified_at timestamptz;

-- Consume a recent PIN verification (valid 10 minutes, single use).
CREATE OR REPLACE FUNCTION public.consume_withdrawal_pin_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.withdrawal_pins%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT * INTO _row FROM public.withdrawal_pins WHERE user_id = _uid FOR UPDATE;
  IF _row.user_id IS NULL THEN
    RAISE EXCEPTION 'Set a withdrawal PIN before requesting a payout';
  END IF;
  IF _row.locked_until IS NOT NULL AND _row.locked_until > now() THEN
    RAISE EXCEPTION 'Withdrawal PIN temporarily locked';
  END IF;
  IF _row.pin_verified_at IS NULL OR _row.pin_verified_at < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Withdrawal PIN verification required';
  END IF;
  UPDATE public.withdrawal_pins SET pin_verified_at = NULL WHERE user_id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_withdrawal_pin_verification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_withdrawal_pin_verification() TO service_role;

-- Reject rapid duplicate payout requests (double submit / replayed RPC).
CREATE OR REPLACE FUNCTION public.assert_no_duplicate_payout(_currency text, _amount numeric, _method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payout_requests
    WHERE user_id = _uid
      AND status = 'pending'
      AND currency = _currency
      AND amount = _amount
      AND method = _method
      AND created_at > now() - interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'An identical payout request is already pending';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_no_duplicate_payout(text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_no_duplicate_payout(text, numeric, text) TO service_role;

-- 2. Enforce both guards inside every payout creation path.
CREATE OR REPLACE FUNCTION public.payout_request_create(_currency text, _amount numeric, _method text, _destination jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _bal numeric;
  _new_id uuid;
  _cur text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM public.assert_recent_liveness();
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN
    RAISE EXCEPTION 'invalid currency';
  END IF;
  IF _method NOT IN ('bank','momo','wire') THEN
    RAISE EXCEPTION 'invalid method';
  END IF;

  _cur := _currency;
  PERFORM public.assert_no_duplicate_payout(_cur, _amount, _method);
  PERFORM public.consume_withdrawal_pin_verification();

  SELECT available_balance INTO _bal
  FROM public.wallets
  WHERE user_id = _uid AND currency = _cur
  FOR UPDATE;

  IF _bal IS NULL OR _bal < _amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
  SET available_balance = available_balance - _amount,
      escrow_balance = escrow_balance + _amount,
      updated_at = now()
  WHERE user_id = _uid AND currency = _cur;

  INSERT INTO public.payout_requests(user_id, currency, amount, method, destination, status)
  VALUES (_uid, _cur, _amount, _method, COALESCE(_destination,'{}'::jsonb), 'pending')
  RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
  VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _cur::public.wallet_currency, false, 'pending', now());

  RETURN _new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.payout_request_create_live(_currency text, _amount numeric, _fee numeric, _net numeric, _method text, _destination jsonb, _recipient_id uuid, _recipient_code text, _provider text DEFAULT 'paystack'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _bal numeric;
  _new_id uuid;
  _cur text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM public.assert_recent_liveness();
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _method NOT IN ('bank','momo') THEN
    RAISE EXCEPTION 'invalid method';
  END IF;
  IF _provider NOT IN ('paystack','flutterwave') THEN
    RAISE EXCEPTION 'invalid provider';
  END IF;

  _cur := _currency;
  PERFORM public.assert_no_duplicate_payout(_cur, _amount, _method);
  PERFORM public.consume_withdrawal_pin_verification();

  SELECT available_balance INTO _bal
  FROM public.wallets
  WHERE user_id = _uid AND currency = _cur::public.wallet_currency
  FOR UPDATE;

  IF _bal IS NULL OR _bal < _amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
  SET available_balance = available_balance - _amount,
      escrow_balance = escrow_balance + _amount,
      updated_at = now()
  WHERE user_id = _uid AND currency = _cur::public.wallet_currency;

  INSERT INTO public.payout_requests(user_id, currency, amount, method, destination, status,
    fee_amount, net_amount, recipient_id, paystack_recipient_code,
    provider, provider_recipient_code)
  VALUES (_uid, _cur, _amount, _method, COALESCE(_destination,'{}'::jsonb), 'pending',
    _fee, _net, _recipient_id,
    CASE WHEN _provider = 'paystack' THEN _recipient_code ELSE NULL END,
    _provider, _recipient_code)
  RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
  VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _cur::public.wallet_currency, false, 'pending', now());

  RETURN _new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.payout_request_create_usd(_usd_amount numeric, _source_currency text, _source_amount numeric, _channel text, _destination jsonb)
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

  PERFORM public.assert_no_duplicate_payout('USD', _usd_amount, 'wire');
  PERFORM public.consume_withdrawal_pin_verification();

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