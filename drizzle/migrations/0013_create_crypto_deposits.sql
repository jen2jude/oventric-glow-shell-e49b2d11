CREATE TABLE public.crypto_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  usd_amount NUMERIC(18,2) NOT NULL CHECK (usd_amount > 0),
  fx_rate NUMERIC(18,6) NOT NULL CHECK (fx_rate > 0),
  pay_currency TEXT NOT NULL DEFAULT 'usdttrc20',
  pay_amount NUMERIC(24,8),
  received_amount NUMERIC(24,8),
  provider TEXT NOT NULL DEFAULT 'nowpayments',
  provider_payment_id TEXT NOT NULL,
  pay_address TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment','confirming','credited','underpaid','overpaid','expired','failed')),
  credit_reference TEXT,
  last_provider_status TEXT,
  note TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX crypto_deposits_provider_payment_id_key
  ON public.crypto_deposits (provider, provider_payment_id);
CREATE INDEX crypto_deposits_user_created_idx
  ON public.crypto_deposits (user_id, created_at DESC);
CREATE INDEX crypto_deposits_status_idx ON public.crypto_deposits (status);

GRANT SELECT ON public.crypto_deposits TO authenticated;
GRANT ALL ON public.crypto_deposits TO service_role;

ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own crypto deposits"
  ON public.crypto_deposits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management roles read all crypto deposits"
  ON public.crypto_deposits FOR SELECT TO authenticated
  USING (public.has_any_management_role(auth.uid()));

CREATE TRIGGER crypto_deposits_set_updated_at
  BEFORE UPDATE ON public.crypto_deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();