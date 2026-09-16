-- Stage 3 hardening: promotional records are written only by server-side
-- settlement (service role). Browsers may read their own rows, never write.
REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.referral_settings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.coupon_redemptions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.coupons FROM anon;
GRANT ALL ON public.referrals TO service_role;
GRANT ALL ON public.referral_settings TO service_role;
GRANT ALL ON public.coupon_redemptions TO service_role;
GRANT ALL ON public.coupons TO service_role;