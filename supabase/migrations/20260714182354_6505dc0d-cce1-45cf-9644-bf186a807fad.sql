ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS phone text;
UPDATE public.jobs j SET phone = sv.phone
FROM public.site_visits sv
WHERE j.site_visit_id = sv.id AND j.phone IS NULL AND sv.phone IS NOT NULL;