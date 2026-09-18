DO $$
DECLARE
  f record;
  -- functions that must be callable ONLY by the server (service role)
  server_only text[] := ARRAY[
    'wallet_credit','wallet_debit','wallet_credit_currency','wallet_debit_currency',
    'cashback_credit','cashback_debit','system_wallet_credit','system_wallet_debit',
    'bounty_publish_lock','bounty_publish_lock_currency','bounty_release_escrow',
    'bounty_refund_escrow','bounty_auto_release_due','bounty_wallet_transfer_to_main'
  ];
  -- functions that enforce auth.uid()/has_role internally and are called with the user's JWT
  user_callable text[] := ARRAY[
    'admin_reset_wallet','activate_campaign','end_campaign','pause_campaign',
    'payout_request_create','payout_request_create_live','payout_request_create_usd',
    'payout_request_cancel_own','payout_request_mark_paid','payout_request_reject'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname = ANY(server_only) OR p.proname = ANY(user_callable))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    IF f.proname = ANY(user_callable) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;
END $$;