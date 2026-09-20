-- Remove unbound public read on private image buckets. Public pages now sign
-- these images server-side with the service-role client.
DROP POLICY IF EXISTS "avatars: public read" ON storage.objects;
DROP POLICY IF EXISTS "product-covers: public read" ON storage.objects;
DROP POLICY IF EXISTS "profile-covers: public read" ON storage.objects;

-- Owners keep direct read access to their own files (upload previews, editors).
CREATE POLICY "product-covers_owner_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-covers'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
);

-- Moderation/admin screens read any product cover.
CREATE POLICY "product-covers_admin_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-covers'
  AND public.has_any_management_role(auth.uid())
);