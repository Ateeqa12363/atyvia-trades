
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS callback_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS callback_completed_at timestamptz;

CREATE POLICY "Users can update calls for their own sites"
  ON public.calls
  FOR UPDATE
  TO authenticated
  USING (
    site_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = calls.site_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    site_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = calls.site_id AND s.user_id = auth.uid()
    )
  );
