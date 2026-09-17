CREATE TABLE public.seller_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  legal_name text,
  brand_name text,
  contact_email text,
  country text,
  website text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_verification_requests_status_check CHECK (status IN ('pending','approved','rejected'))
);

CREATE UNIQUE INDEX seller_verification_requests_one_pending
  ON public.seller_verification_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX seller_verification_requests_user_idx
  ON public.seller_verification_requests (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.seller_verification_requests TO authenticated;
GRANT ALL ON public.seller_verification_requests TO service_role;

ALTER TABLE public.seller_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers read own verification requests"
  ON public.seller_verification_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_any_management_role(auth.uid()));

CREATE POLICY "Sellers create own pending verification request"
  ON public.seller_verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);

CREATE TRIGGER seller_verification_requests_touch
  BEFORE UPDATE ON public.seller_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();