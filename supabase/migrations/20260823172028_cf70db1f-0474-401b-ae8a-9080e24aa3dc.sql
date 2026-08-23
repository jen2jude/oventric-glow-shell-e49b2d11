
-- 1. post_saves: exclude guest/anonymous sessions
DROP POLICY IF EXISTS "Users manage their own saves" ON public.post_saves;
CREATE POLICY "Users manage their own saves"
ON public.post_saves FOR ALL TO authenticated
USING (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = user_id)
WITH CHECK (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = user_id);

-- 2. Block-aware comment creation
CREATE OR REPLACE FUNCTION public.is_blocked_by_post_author(_post_id uuid, _is_blog boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _is_blog THEN EXISTS (
      SELECT 1 FROM public.blog_posts bp
      JOIN public.user_blocks ub
        ON ub.blocker_id = bp.author_id AND ub.blocked_id = auth.uid()
      WHERE bp.id = _post_id
    )
    ELSE EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.user_blocks ub
        ON ub.blocker_id = p.author_id AND ub.blocked_id = auth.uid()
      WHERE p.id = _post_id
    )
  END
$$;

DROP POLICY IF EXISTS "author can insert own comments" ON public.post_comments;
CREATE POLICY "author can insert own comments"
ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND auth.uid() = author_id
  AND public.post_visible_to_me(post_id)
  AND NOT public.is_blocked_by_post_author(post_id, false)
);

DROP POLICY IF EXISTS "author can update own comments" ON public.post_comments;
CREATE POLICY "author can update own comments"
ON public.post_comments FOR UPDATE TO authenticated
USING (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = author_id)
WITH CHECK (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = author_id);

DROP POLICY IF EXISTS "blog_comments write own" ON public.blog_comments;
CREATE POLICY "blog_comments insert own"
ON public.blog_comments FOR INSERT TO authenticated
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND auth.uid() = user_id
  AND NOT public.is_blocked_by_post_author(post_id, true)
);
CREATE POLICY "blog_comments update own"
ON public.blog_comments FOR UPDATE TO authenticated
USING (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = user_id)
WITH CHECK (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = user_id);
CREATE POLICY "blog_comments delete own"
ON public.blog_comments FOR DELETE TO authenticated
USING (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = user_id);
