ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS creator_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.creator_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  caption text,
  media_paths text[] NOT NULL DEFAULT '{}',
  media_type text,
  community_link text,
  external_url text,
  external_provider text,
  fields text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.creator_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_posts TO authenticated;
GRANT ALL ON public.creator_posts TO service_role;

ALTER TABLE public.creator_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published creator posts are public"
ON public.creator_posts FOR SELECT
USING (status = 'published');

CREATE POLICY "Owners read own creator posts"
ON public.creator_posts FOR SELECT TO authenticated
USING (auth.uid() = author_id);

CREATE POLICY "Owners insert own creator posts"
ON public.creator_posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Owners update own creator posts"
ON public.creator_posts FOR UPDATE TO authenticated
USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Owners delete own creator posts"
ON public.creator_posts FOR DELETE TO authenticated
USING (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS creator_posts_created_idx ON public.creator_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS creator_posts_author_idx ON public.creator_posts (author_id);

CREATE TRIGGER creator_posts_updated_at
BEFORE UPDATE ON public.creator_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();