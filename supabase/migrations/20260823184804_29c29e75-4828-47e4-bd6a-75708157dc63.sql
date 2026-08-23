CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence_select_authenticated" ON public.user_presence;
CREATE POLICY "presence_select_authenticated" ON public.user_presence
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "presence_insert_own" ON public.user_presence;
CREATE POLICY "presence_insert_own" ON public.user_presence
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "presence_update_own" ON public.user_presence;
CREATE POLICY "presence_update_own" ON public.user_presence
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS user_presence_last_seen_idx ON public.user_presence (last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_presence (user_id, last_seen_at)
  SELECT auth.uid(), now()
  WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now();
$$;

REVOKE ALL ON FUNCTION public.touch_presence() FROM public;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;