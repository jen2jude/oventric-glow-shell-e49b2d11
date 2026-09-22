ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS alt_phone TEXT;

COMMENT ON COLUMN public.profiles.whatsapp_phone IS 'Required WhatsApp contact number (with country code) so support can reach sellers about deliveries.';
COMMENT ON COLUMN public.profiles.alt_phone IS 'Optional secondary contact number (with country code).';
