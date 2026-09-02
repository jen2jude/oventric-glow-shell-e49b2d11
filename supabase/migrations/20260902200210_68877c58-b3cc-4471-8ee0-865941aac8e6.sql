CREATE OR REPLACE FUNCTION public.assert_recent_liveness()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Liveness/selfie verification has been retired. Withdrawals are now
  -- protected by the user's 4-digit withdrawal PIN, enforced in the app.
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_recent_liveness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_recent_liveness() TO authenticated, service_role;