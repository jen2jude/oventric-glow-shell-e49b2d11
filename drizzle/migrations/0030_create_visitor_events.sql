CREATE TABLE IF NOT EXISTS public.visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  user_id uuid,
  path text NOT NULL,
  referrer text,
  referrer_host text,
  country text,
  city text,
  region text,
  device text,
  browser text,
  os text,
  language text,
  screen_w integer,
  user_agent text
);

GRANT ALL ON public.visitor_events TO service_role;

ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read visitor events"
ON public.visitor_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.visitor_events TO authenticated;

CREATE INDEX IF NOT EXISTS visitor_events_occurred_at_idx ON public.visitor_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_visitor_idx ON public.visitor_events (visitor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_user_idx ON public.visitor_events (user_id, occurred_at DESC);