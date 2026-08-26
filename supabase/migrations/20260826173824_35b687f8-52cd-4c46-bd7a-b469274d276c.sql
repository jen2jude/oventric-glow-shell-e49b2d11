-- 1) user_presence: exclude anonymous sessions
DROP POLICY IF EXISTS presence_select_authenticated ON public.user_presence;
CREATE POLICY presence_select_authenticated ON public.user_presence
FOR SELECT TO authenticated
USING (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

DROP POLICY IF EXISTS presence_update_own ON public.user_presence;
CREATE POLICY presence_update_own ON public.user_presence
FOR UPDATE TO authenticated
USING (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND user_id = auth.uid())
WITH CHECK (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND user_id = auth.uid());

DROP POLICY IF EXISTS presence_insert_own ON public.user_presence;
CREATE POLICY presence_insert_own ON public.user_presence
FOR INSERT TO authenticated
WITH CHECK (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND user_id = auth.uid());

-- 2) Explicit, durable column-level revokes for sensitive PII
DO $$
DECLARE
  t text; c text; r text;
  cols text[];
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOR t, cols IN
      SELECT * FROM (VALUES
        ('ad_campaigns', ARRAY['advertiser_email','advertiser_whatsapp','cta_lead_email']),
        ('products', ARRAY['seller_phone','whatsapp_number','social_link']),
        ('profiles', ARRAY['phone','address','date_of_birth','kyc_id_front_path','kyc_id_back_path','kyc_selfie_path','kyc_document_path','kyc_id_number'])
      ) v(t, cols)
    LOOP
      FOREACH c IN ARRAY cols LOOP
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name=t AND column_name=c
        ) THEN
          EXECUTE format('REVOKE ALL (%I) ON public.%I FROM %I', c, t, r);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- 3) Self-check function: raises if any sensitive column becomes readable by anon/authenticated
CREATE OR REPLACE FUNCTION public.assert_public_column_privacy()
RETURNS TABLE(table_name text, column_name text, grantee text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT cp.table_name::text, cp.column_name::text, cp.grantee::text
  FROM information_schema.column_privileges cp
  WHERE cp.table_schema = 'public'
    AND cp.grantee IN ('anon','authenticated')
    AND cp.privilege_type = 'SELECT'
    AND (
      (cp.table_name = 'ad_campaigns' AND cp.column_name IN ('advertiser_email','advertiser_whatsapp','cta_lead_email'))
      OR (cp.table_name = 'products' AND cp.column_name IN ('seller_phone','whatsapp_number','social_link'))
      OR (cp.table_name = 'profiles' AND cp.column_name IN ('phone','address','date_of_birth','kyc_id_front_path','kyc_id_back_path','kyc_selfie_path','kyc_document_path','kyc_id_number'))
    );
$$;

GRANT EXECUTE ON FUNCTION public.assert_public_column_privacy() TO authenticated, service_role;