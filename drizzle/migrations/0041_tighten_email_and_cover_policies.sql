-- Email tables: drop the broad {public}-role policies. Equivalent
-- service_role-scoped policies already exist on each table.
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;

DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;

DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;

-- Product cover review: narrow from any management role to the roles that
-- actually moderate seller listings.
DROP POLICY IF EXISTS "product-covers_admin_read" ON storage.objects;
CREATE POLICY "product-covers_admin_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-covers'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  )
);