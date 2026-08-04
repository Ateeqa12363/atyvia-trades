ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS cal_booking_id text,
  ADD COLUMN IF NOT EXISTS visit_completed_at timestamp with time zone;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status = ANY (ARRAY['awaiting_quote'::text, 'draft'::text, 'sent'::text, 'accepted'::text, 'declined'::text, 'expired'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS quotes_cal_booking_id_key ON public.quotes (cal_booking_id) WHERE cal_booking_id IS NOT NULL;