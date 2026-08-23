ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_story_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_story_view_count ON public.story_views;
CREATE TRIGGER trg_bump_story_view_count
AFTER INSERT ON public.story_views
FOR EACH ROW EXECUTE FUNCTION public.bump_story_view_count();

-- Stories stay forever as reels; only the 24h circle rail filters on expires_at.
DROP POLICY IF EXISTS stories_select_live ON public.stories;
CREATE POLICY stories_select_all ON public.stories
FOR SELECT TO authenticated
USING (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

-- Retire the destructive purge: reels must persist past 24h.
CREATE OR REPLACE FUNCTION public.purge_expired_stories()
RETURNS integer
LANGUAGE sql
SET search_path = public
AS $$ SELECT 0; $$;

-- Backfill counts from existing view rows.
UPDATE public.stories s
SET view_count = COALESCE(v.c, 0)
FROM (SELECT story_id, count(*)::int c FROM public.story_views GROUP BY story_id) v
WHERE v.story_id = s.id AND s.view_count = 0;