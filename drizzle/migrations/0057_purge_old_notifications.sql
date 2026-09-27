-- Auto-clear notifications older than 20 days.
CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.notifications
    WHERE created_at < now() - interval '20 days'
    RETURNING id
  )
  SELECT count(*)::integer FROM deleted;
$$;

REVOKE ALL ON FUNCTION public.purge_old_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_notifications() TO service_role;

-- Daily cleanup at 03:00 UTC when pg_cron is available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('purge-old-notifications', '0 3 * * *', 'SELECT public.purge_old_notifications()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END $$;