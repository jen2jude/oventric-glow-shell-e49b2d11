ALTER TABLE public.creator_posts
ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.creator_post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.creator_posts(id) ON DELETE CASCADE,
  viewer_id uuid NULL,
  session_key text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT creator_post_views_viewer_or_session CHECK (viewer_id IS NOT NULL OR session_key IS NOT NULL)
);

GRANT INSERT ON public.creator_post_views TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_post_views TO authenticated;
GRANT ALL ON public.creator_post_views TO service_role;

ALTER TABLE public.creator_post_views ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS creator_post_views_post_viewer_uidx
ON public.creator_post_views(post_id, viewer_id)
WHERE viewer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creator_post_views_post_session_uidx
ON public.creator_post_views(post_id, session_key)
WHERE session_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_post_views_post_idx
ON public.creator_post_views(post_id);

CREATE POLICY "Anyone can record creator post views"
ON public.creator_post_views
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.creator_posts cp
    WHERE cp.id = post_id
      AND cp.status = 'published'
  )
);

CREATE POLICY "Creators can read views for own posts"
ON public.creator_post_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.creator_posts cp
    WHERE cp.id = post_id
      AND cp.author_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.bump_creator_post_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.creator_posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER creator_post_views_bump_count
AFTER INSERT ON public.creator_post_views
FOR EACH ROW
EXECUTE FUNCTION public.bump_creator_post_view_count();