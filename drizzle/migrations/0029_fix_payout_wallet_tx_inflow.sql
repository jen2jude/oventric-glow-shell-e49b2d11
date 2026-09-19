CREATE OR REPLACE FUNCTION public.payout_request_create_live(_currency text, _amount numeric, _fee numeric, _net numeric, _method text, _destination jsonb, _recipient_id uuid, _recipient_code text, _provider text DEFAULT 'manual'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _avail numeric;
  _id uuid;
  _tx_currency public.wallet_currency;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _currency NOT IN ('NGN','GHS') THEN RAISE EXCEPTION 'unsupported payout currency %', _currency; END IF;
  IF _method NOT IN ('bank','momo') THEN RAISE EXCEPTION 'unsupported payout method %', _method; END IF;
  IF _provider NOT IN ('manual','paystack','flutterwave') THEN RAISE EXCEPTION 'unsupported provider %', _provider; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF _net IS NULL OR _net <= 0 THEN RAISE EXCEPTION 'net amount must be positive'; END IF;

  _tx_currency := _currency::public.wallet_currency;

  PERFORM public.assert_no_duplicate_payout(_currency, _amount, _method);
  PERFORM public.consume_withdrawal_pin_verification();

  SELECT available_balance INTO _avail
    FROM public.wallets
    WHERE user_id = _uid AND currency = _currency
    FOR UPDATE;

  IF _avail IS NULL THEN RAISE EXCEPTION 'no % wallet', _currency; END IF;
  IF _avail < _amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  UPDATE public.wallets
    SET available_balance = available_balance - _amount,
        escrow_balance = escrow_balance + _amount,
        updated_at = now()
    WHERE user_id = _uid AND currency = _currency;

  INSERT INTO public.payout_requests (
    user_id, currency, amount, method, destination, status,
    fee_amount, net_amount, recipient_id, provider, provider_recipient_code, paystack_recipient_code
  ) VALUES (
    _uid, _currency, _amount, _method, _destination, 'pending',
    _fee, _net, _recipient_id, _provider, _recipient_code, _recipient_code
  ) RETURNING id INTO _id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, currency, inflow, status, tx_hash, description)
  VALUES (_uid, 'Payout Withdrawal', _amount, _tx_currency, false, 'pending',
          'PYT-'||substr(_id::text,1,8),
          'Withdrawal to '||_method);

  RETURN _id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text, text) TO service_role;