ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;