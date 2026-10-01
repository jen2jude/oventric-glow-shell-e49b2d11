CREATE TABLE public.creator_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  cover_url text,
  category text,
  required_tools text[] NOT NULL DEFAULT '{}',
  rules text NOT NULL DEFAULT '',
  submission_requirements text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  prize_title text,
  prize_details text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT ON public.creator_challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_challenges TO authenticated;
GRANT ALL ON public.creator_challenges TO service_role;
ALTER TABLE public.creator_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads live challenges" ON public.creator_challenges FOR SELECT TO anon, authenticated USING (status IN ('published','closed'));
CREATE POLICY "Content admins manage challenges" ON public.creator_challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content'));
CREATE TRIGGER creator_challenges_updated BEFORE UPDATE ON public.creator_challenges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.creator_challenge_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.creator_challenges(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.creator_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  featured boolean NOT NULL DEFAULT false,
  moderation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, post_id)
);
CREATE INDEX creator_challenge_submissions_challenge_idx ON public.creator_challenge_submissions(challenge_id, featured DESC, created_at DESC);
GRANT SELECT ON public.creator_challenge_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_challenge_submissions TO authenticated;
GRANT ALL ON public.creator_challenge_submissions TO service_role;
ALTER TABLE public.creator_challenge_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads visible submissions" ON public.creator_challenge_submissions FOR SELECT TO anon, authenticated
  USING (status = 'visible' AND EXISTS (SELECT 1 FROM public.creator_challenges c WHERE c.id = challenge_id AND c.status IN ('published','closed')));
CREATE POLICY "Creators read own submissions" ON public.creator_challenge_submissions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Creators submit own published posts to open challenges" ON public.creator_challenge_submissions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND status = 'visible' AND featured = false
    AND EXISTS (SELECT 1 FROM public.creator_posts p WHERE p.id = post_id AND p.author_id = auth.uid() AND p.status = 'published')
    AND EXISTS (SELECT 1 FROM public.creator_challenges c WHERE c.id = challenge_id AND c.status = 'published' AND now() BETWEEN c.starts_at AND c.ends_at)
  );
CREATE POLICY "Creators withdraw own submissions" ON public.creator_challenge_submissions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Moderators manage submissions" ON public.creator_challenge_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content') OR public.has_role(auth.uid(),'moderator'));