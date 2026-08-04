
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retell_call_id TEXT UNIQUE NOT NULL,
  agent_id TEXT,
  from_number TEXT,
  to_number TEXT,
  caller_name TEXT,
  direction TEXT,
  status TEXT,
  disconnect_reason TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  transcript TEXT,
  summary TEXT,
  sentiment TEXT,
  recording_url TEXT,
  booked_appointment BOOLEAN DEFAULT false,
  appointment_time TIMESTAMPTZ,
  appointment_notes TEXT,
  custom_data JSONB,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calls_start_time ON public.calls (start_time DESC);

GRANT SELECT ON public.calls TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read calls (demo)"
  ON public.calls FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
