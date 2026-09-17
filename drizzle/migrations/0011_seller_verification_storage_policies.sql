CREATE POLICY "Sellers upload own verification docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'seller-verification' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Sellers read own verification docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'seller-verification' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Sellers update own verification docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'seller-verification' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'seller-verification' AND (storage.foldername(name))[1] = auth.uid()::text);