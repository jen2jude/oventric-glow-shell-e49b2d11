CREATE TABLE public.creator_post_likes (
  post_id uuid NOT NULL REFERENCES public.creator_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.creator_post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.creator_post_likes TO authenticated;
GRANT ALL ON public.creator_post_likes TO service_role;
ALTER TABLE public.creator_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read showcase likes" ON public.creator_post_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users like as themselves" ON public.creator_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own likes" ON public.creator_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.creator_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.creator_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_post_comments_post_idx ON public.creator_post_comments(post_id, created_at);
GRANT SELECT ON public.creator_post_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.creator_post_comments TO authenticated;
GRANT ALL ON public.creator_post_comments TO service_role;
ALTER TABLE public.creator_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read showcase comments" ON public.creator_post_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users comment as themselves" ON public.creator_post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.creator_post_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = (SELECT author_id FROM public.creator_posts p WHERE p.id = post_id));

CREATE OR REPLACE FUNCTION public.log_seller_view(_seller_id uuid, _product_id uuid, _kind text, _viewer_key text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _key text;
BEGIN
  IF _kind NOT IN ('shop_visit','product_view','profile_visit','profile_visit_post') OR _seller_id IS NULL THEN RETURN; END IF;
  IF _uid IS NOT NULL AND _uid = _seller_id THEN RETURN; END IF;
  _key := left(coalesce(_uid::text, nullif(trim(_viewer_key), ''), 'anon'), 64);
  IF EXISTS (SELECT 1 FROM seller_view_events WHERE seller_id = _seller_id AND kind = _kind
     AND product_id IS NOT DISTINCT FROM _product_id AND viewer_key = _key
     AND created_at > now() - interval '30 minutes') THEN RETURN; END IF;
  INSERT INTO seller_view_events (seller_id, product_id, kind, viewer_key, viewer_id)
  VALUES (_seller_id, _product_id, _kind, _key, _uid);
END $function$;