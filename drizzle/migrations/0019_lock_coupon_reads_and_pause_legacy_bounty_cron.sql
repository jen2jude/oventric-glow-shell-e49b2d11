-- Coupon codes must not be readable through the Data API: validation and
-- redemption are server-side only.
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;
REVOKE SELECT ON public.coupons FROM anon, authenticated;
GRANT ALL ON public.coupons TO service_role;

-- Bounties are a paused (non-MVP) system; its escrow sweeper must not run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bounty-auto-release') THEN
    PERFORM cron.unschedule('bounty-auto-release');
  END IF;
END $$;