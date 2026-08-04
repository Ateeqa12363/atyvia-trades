ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cal_booking_id text;
CREATE INDEX IF NOT EXISTS jobs_cal_booking_id_idx ON public.jobs(cal_booking_id);