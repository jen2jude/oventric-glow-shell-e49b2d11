ALTER TABLE public.creator_post_events DROP CONSTRAINT IF EXISTS creator_post_events_kind_check;
ALTER TABLE public.creator_post_events ADD CONSTRAINT creator_post_events_kind_check CHECK (kind = ANY (ARRAY['play','link_click','full_video_click','share']));
CREATE INDEX IF NOT EXISTS creator_post_events_author_kind_idx ON public.creator_post_events(author_id, kind, created_at);
CREATE OR REPLACE FUNCTION public.log_creator_post_event(_post_id uuid, _kind text, _seconds numeric, _target text, _session text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _author uuid;
BEGIN
  IF _kind NOT IN ('play','link_click','full_video_click','share') THEN RETURN; END IF;
  SELECT author_id INTO _author FROM creator_posts WHERE id = _post_id AND status = 'published';
  IF _author IS NULL OR _author = auth.uid() THEN RETURN; END IF;
  -- shares: at most one per viewer/session per post per 30 minutes
  IF _kind = 'share' AND EXISTS (SELECT 1 FROM creator_post_events WHERE post_id = _post_id AND kind = 'share'
     AND (viewer_id IS NOT DISTINCT FROM auth.uid()) AND session_key IS NOT DISTINCT FROM left(_session, 80)
     AND created_at > now() - interval '30 minutes') THEN RETURN; END IF;
  INSERT INTO creator_post_events(post_id, author_id, kind, seconds, target, viewer_id, session_key)
  VALUES (_post_id, _author, _kind,
    CASE WHEN _kind = 'play' THEN LEAST(GREATEST(COALESCE(_seconds,0),0), 3600) ELSE 0 END,
    left(_target, 300), auth.uid(), left(_session, 80));
END $function$;