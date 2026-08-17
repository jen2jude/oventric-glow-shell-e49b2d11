-- 1. product_reviews: scope policies to explicit roles and exclude anonymous (guest) sessions
DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.product_reviews;
CREATE POLICY "Reviews are publicly readable"
  ON public.product_reviews FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update their own review" ON public.product_reviews;
CREATE POLICY "Users can update their own review"
  ON public.product_reviews FOR UPDATE
  TO authenticated
  USING (
    COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    AND auth.uid() = user_id
  )
  WITH CHECK (
    COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can delete their own review" ON public.product_reviews;
CREATE POLICY "Users can delete their own review"
  ON public.product_reviews FOR DELETE
  TO authenticated
  USING (
    COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    AND auth.uid() = user_id
  );

-- 2. ad_daily_spend: make the fail-closed write posture explicit
REVOKE INSERT, UPDATE, DELETE ON public.ad_daily_spend FROM anon, authenticated;
GRANT ALL ON public.ad_daily_spend TO service_role;

-- 3. products: pin column-level protection of seller contact details
REVOKE SELECT (seller_phone, whatsapp_number) ON public.products FROM anon, authenticated;
GRANT ALL ON public.products TO service_role;

-- 4. profiles: pin column-level protection of PII / KYC paths
REVOKE SELECT (phone, address, date_of_birth, kyc_selfie_path, kyc_id_path, deletion_liveness_path)
  ON public.profiles FROM anon, authenticated;
GRANT ALL ON public.profiles TO service_role;