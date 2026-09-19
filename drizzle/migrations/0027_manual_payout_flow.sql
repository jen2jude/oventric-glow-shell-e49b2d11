-- 1. Allow the manual provider on live payout requests (no Paystack transfer).
CREATE OR REPLACE FUNCTION public.payout_request_create_live(
  _currency text,
  _amount numeric,
  _fee numeric,
  _net numeric,
  _method text,
  _destination jsonb,
  _recipient_id uuid,
  _recipient_code text,
  _provider text DEFAULT 'manual'
)
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

  INSERT INTO public.wallet_transactions (user_id, type, amount, currency, status, tx_hash, description)
  VALUES (_uid, 'Payout Withdrawal', _amount, _tx_currency, 'pending',
          'PYT-'||substr(_id::text,1,8),
          'Withdrawal to '||_method);

  RETURN _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.payout_request_create_live(text,numeric,numeric,numeric,text,jsonb,uuid,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.payout_request_create_live(text,numeric,numeric,numeric,text,jsonb,uuid,text,text) TO authenticated, service_role;

-- 2. Notify the user for every payout request, including manual rails.
CREATE OR REPLACE FUNCTION public.notify_on_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.user_id, 'payout_request',
      'Withdrawal request submitted',
      NEW.currency || ' ' || NEW.amount::TEXT || ' has been deducted from your wallet and is pending review.');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.user_id, 'payout_' || NEW.status,
      CASE
        WHEN NEW.status = 'rejected' THEN 'Withdrawal unsuccessful — refunded'
        WHEN NEW.status = 'paid' THEN 'Withdrawal successful'
        WHEN NEW.status = 'approved' THEN 'Withdrawal approved'
        ELSE 'Payout ' || NEW.status END,
      CASE
        WHEN NEW.status = 'paid' THEN NEW.currency || ' ' || NEW.amount::TEXT || ' has been transferred to your account.'
        WHEN NEW.status = 'rejected' THEN COALESCE(NEW.reject_reason,'No reason given') || ' Your wallet has been refunded.'
        WHEN NEW.status = 'approved' THEN NEW.currency || ' ' || NEW.amount::TEXT || ' is approved and being transferred.'
        ELSE 'Status updated to ' || NEW.status
      END);
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Flag a payout as needing the user's attention without refunding it.
CREATE OR REPLACE FUNCTION public.payout_request_flag_issue(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row public.payout_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _row FROM public.payout_requests WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'cannot flag in status %', _row.status;
  END IF;

  UPDATE public.payout_requests
    SET status = 'pending',
        admin_note = _reason,
        reject_reason = NULL,
        processed_by = auth.uid()
    WHERE id = _id;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_row.user_id, 'payout_request',
    'Withdrawal on hold — action needed',
    COALESCE(_reason, 'We could not complete your transfer.') || ' Your funds are still held for this request. Please correct the details or contact support to complete it.');
END;
$function$;

REVOKE ALL ON FUNCTION public.payout_request_flag_issue(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.payout_request_flag_issue(uuid, text) TO authenticated, service_role;
