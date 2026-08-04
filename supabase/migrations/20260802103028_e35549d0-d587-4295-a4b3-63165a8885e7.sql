ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS caller_name_verified boolean NOT NULL DEFAULT false;