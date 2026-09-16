-- Stage 2: orders, withdrawals and ledger rows may only be written by
-- server-side settlement code (service_role), never by a browser session.

-- Orders: created exclusively by gateway settlement or the wallet-payment
-- server function (both use the service client).
DROP POLICY IF EXISTS "Buyers insert own orders" ON public.orders;
REVOKE INSERT ON public.orders FROM authenticated, anon;

-- Withdrawals: created exclusively by the balance-locking SECURITY DEFINER
-- RPCs (payout_request_create / _live / _usd).
DROP POLICY IF EXISTS "users create own payouts" ON public.payout_requests;
DROP POLICY IF EXISTS "users cancel own pending" ON public.payout_requests;
REVOKE INSERT ON public.payout_requests FROM authenticated, anon;
REVOKE UPDATE ON public.payout_requests FROM anon;

-- Ledger + balances: no direct client writes at all.
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM authenticated, anon;

-- Owner-side cancel of a pending withdrawal, with the escrow refund done
-- atomically in the same transaction.
CREATE OR REPLACE FUNCTION public.payout_request_cancel_own(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.payout_requests%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO _row FROM public.payout_requests WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL OR _row.user_id <> _uid THEN
    RAISE EXCEPTION 'not found';
  END IF;
  IF _row.status <> 'pending' THEN
    RAISE EXCEPTION 'only pending requests can be cancelled';
  END IF;

  UPDATE public.wallets
  SET escrow_balance = GREATEST(0, escrow_balance - _row.amount),
      available_balance = available_balance + LEAST(escrow_balance, _row.amount),
      updated_at = now()
  WHERE user_id = _uid AND currency = _row.currency::public.wallet_currency;

  UPDATE public.payout_requests
  SET status = 'cancelled', processed_at = now()
  WHERE id = _id;

  UPDATE public.wallet_transactions
  SET status = 'failed'
  WHERE user_id = _uid
    AND type = 'Payout Withdrawal'
    AND tx_hash = 'PYT-' || substr(_id::text, 1, 8);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.payout_request_cancel_own(uuid) TO authenticated;