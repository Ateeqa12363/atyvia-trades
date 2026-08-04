
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS respond_token TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS responded_by TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_respond_token_key ON public.quotes(respond_token) WHERE respond_token IS NOT NULL;
