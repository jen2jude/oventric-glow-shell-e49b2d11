CREATE TABLE public.creator_post_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.creator_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('play','link_click','full_video_click')),
  seconds numeric NOT NULL DEFAULT 0,
  target text,
  viewer_id uuid,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_post_events_author_idx ON public.creator_post_events(author_id, kind);
CREATE INDEX creator_post_events_post_idx ON public.creator_post_events(post_id);
GRANT SELECT ON public.creator_post_events TO authenticated;
GRANT ALL ON public.creator_post_events TO service_role;
ALTER TABLE public.creator_post_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authors read own creator post events" ON public.creator_post_events
  FOR SELECT TO authenticated USING (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.log_creator_post_event(_post_id uuid, _kind text, _seconds numeric, _target text, _session text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _author uuid;
BEGIN
  IF _kind NOT IN ('play','link_click','full_video_click') THEN RETURN; END IF;
  SELECT author_id INTO _author FROM creator_posts WHERE id = _post_id AND status = 'published';
  IF _author IS NULL OR _author = auth.uid() THEN RETURN; END IF;
  INSERT INTO creator_post_events(post_id, author_id, kind, seconds, target, viewer_id, session_key)
  VALUES (_post_id, _author, _kind,
    CASE WHEN _kind = 'play' THEN LEAST(GREATEST(COALESCE(_seconds,0),0), 3600) ELSE 0 END,
    left(_target, 300), auth.uid(), left(_session, 80));
END $$;
GRANT EXECUTE ON FUNCTION public.log_creator_post_event(uuid, text, numeric, text, text) TO anon, authenticated;