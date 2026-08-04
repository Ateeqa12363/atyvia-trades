CREATE POLICY "Owners manage their branding files"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'branding'
  AND EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[1] = s.id::text
  )
)
WITH CHECK (
  bucket_id = 'branding'
  AND EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[1] = s.id::text
  )
);