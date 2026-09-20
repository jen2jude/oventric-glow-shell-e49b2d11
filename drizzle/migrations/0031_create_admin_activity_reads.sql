CREATE TABLE public.admin_activity_reads (
  user_id uuid NOT NULL,
  section text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_activity_reads TO authenticated;
GRANT ALL ON public.admin_activity_reads TO service_role;

ALTER TABLE public.admin_activity_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management users read own activity markers"
ON public.admin_activity_reads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND public.has_any_management_role(auth.uid()));

CREATE POLICY "Management users insert own activity markers"
ON public.admin_activity_reads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_any_management_role(auth.uid()));

CREATE POLICY "Management users update own activity markers"
ON public.admin_activity_reads
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.has_any_management_role(auth.uid()))
WITH CHECK (auth.uid() = user_id AND public.has_any_management_role(auth.uid()));

CREATE POLICY "Management users delete own activity markers"
ON public.admin_activity_reads
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND public.has_any_management_role(auth.uid()));

CREATE INDEX admin_activity_reads_seen_idx
ON public.admin_activity_reads (user_id, seen_at DESC);