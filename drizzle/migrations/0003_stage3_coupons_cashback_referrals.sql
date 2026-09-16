-- ============ COUPONS: eligibility + limits ============
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS min_purchase_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS per_user_limit integer,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code text NOT NULL REFERENCES public.coupons(code) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reference text,
  discount_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_ref_uidx
  ON public.coupon_redemptions (coupon_code, reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON public.coupon_redemptions (user_id, coupon_code);

GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own redemptions readable" ON public.coupon_redemptions;
CREATE POLICY "own redemptions readable" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ SELLER-FUNDED, PRODUCT-LEVEL CASHBACK ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cashback_pct numeric NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_cashback_pct_check CHECK (cashback_pct >= 0 AND cashback_pct <= 50);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ REFERRALS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text;
UPDATE public.profiles
  SET referral_code = upper(substr(md5(user_id::text), 1, 8))
  WHERE referral_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uidx ON public.profiles (referral_code);

CREATE TABLE IF NOT EXISTS public.referrals (
  invitee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  qualified_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  qualified_at timestamptz,
  reward_amount_usd numeric NOT NULL DEFAULT 0,
  CONSTRAINT referrals_no_self CHECK (invitee_id <> referrer_id),
  CONSTRAINT referrals_status_check CHECK (status IN ('pending','qualified'))
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_reward_uidx
  ON public.referrals (invitee_id) WHERE status = 'qualified';

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral parties can read" ON public.referrals;
CREATE POLICY "referral parties can read" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = invitee_id);

CREATE TABLE IF NOT EXISTS public.referral_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  reward_amount_usd numeric NOT NULL DEFAULT 1,
  min_purchase_usd numeric NOT NULL DEFAULT 5,
  qualification_days integer NOT NULL DEFAULT 90,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_settings_singleton CHECK (id = 1)
);
INSERT INTO public.referral_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.referral_settings TO authenticated, anon;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral settings readable" ON public.referral_settings;
CREATE POLICY "referral settings readable" ON public.referral_settings
  FOR SELECT USING (true);

-- Promotional credit ledger type for referral rewards.
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'Referral Reward';