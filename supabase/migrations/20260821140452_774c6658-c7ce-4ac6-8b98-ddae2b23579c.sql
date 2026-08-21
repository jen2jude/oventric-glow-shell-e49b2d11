REVOKE SELECT (cta_whatsapp) ON public.ad_campaigns FROM anon, authenticated;

DROP POLICY IF EXISTS "Share logs visible to sharer, author, admins" ON public.post_shares;
CREATE POLICY "Share logs visible to sharer, author, admins"
ON public.post_shares FOR SELECT TO authenticated
USING (
  COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_shares.post_id AND p.author_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Users log their own shares" ON public.post_shares;
CREATE POLICY "Users log their own shares"
ON public.post_shares FOR INSERT TO authenticated
WITH CHECK (
  COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND auth.uid() = user_id
);