DROP POLICY IF EXISTS posts_select_wall ON public.posts;
CREATE POLICY posts_select_wall ON public.posts
FOR SELECT
USING (
  wall_user_id IS NOT NULL
  AND audience = 'public'
  AND circle_id IS NULL
  AND ((auth.jwt() IS NULL) OR (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE))
);

DROP POLICY IF EXISTS posts_insert_wall ON public.posts;
CREATE POLICY posts_insert_wall ON public.posts
FOR INSERT
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE
  AND auth.uid() = author_id
  AND wall_user_id IS NOT NULL
  AND circle_id IS NULL
  AND audience = 'public'
);