CREATE TABLE public.purchase_assistant_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary text NOT NULL,
  order_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_assistant_summaries_user_created_idx
  ON public.purchase_assistant_summaries (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.purchase_assistant_summaries TO authenticated;
GRANT ALL ON public.purchase_assistant_summaries TO service_role;

ALTER TABLE public.purchase_assistant_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own purchase summaries"
  ON public.purchase_assistant_summaries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own purchase summaries"
  ON public.purchase_assistant_summaries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own purchase summaries"
  ON public.purchase_assistant_summaries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);