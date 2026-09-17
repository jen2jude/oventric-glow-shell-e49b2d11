ALTER TABLE public.seller_verification_requests
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS proof_doc_path text,
  ADD COLUMN IF NOT EXISTS proof_doc_kind text,
  ADD COLUMN IF NOT EXISTS passport_photo_path text;

ALTER TABLE public.seller_verification_requests
  DROP CONSTRAINT IF EXISTS seller_verification_requests_status_check;

ALTER TABLE public.seller_verification_requests
  ADD CONSTRAINT seller_verification_requests_status_check
  CHECK (status IN ('pending','under_review','approved','rejected'));

ALTER TABLE public.seller_verification_requests
  ADD CONSTRAINT seller_verification_requests_business_type_check
  CHECK (business_type IS NULL OR business_type IN ('registered','unregistered'));

DROP INDEX IF EXISTS public.seller_verification_requests_one_pending;

CREATE UNIQUE INDEX seller_verification_requests_one_open
  ON public.seller_verification_requests (user_id)
  WHERE status IN ('pending','under_review');