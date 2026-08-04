
-- shared updated_at trigger already exists as public.update_updated_at_column()

-- ============================================================
-- site_visits
-- ============================================================
CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  cal_booking_id text UNIQUE,
  customer_name text,
  phone text,
  address text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_visits_status_check CHECK (status IN ('scheduled','visited','quoted','cancelled'))
);
CREATE INDEX site_visits_site_id_idx ON public.site_visits(site_id);
CREATE INDEX site_visits_call_id_idx ON public.site_visits(call_id);
CREATE INDEX site_visits_scheduled_at_idx ON public.site_visits(scheduled_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read site_visits for their sites"
  ON public.site_visits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_visits.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users insert site_visits for their sites"
  ON public.site_visits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_visits.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users update site_visits for their sites"
  ON public.site_visits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_visits.site_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_visits.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users delete site_visits for their sites"
  ON public.site_visits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_visits.site_id AND s.user_id = auth.uid()));

CREATE TRIGGER site_visits_set_updated_at
  BEFORE UPDATE ON public.site_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- quotes
-- ============================================================
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  site_visit_id uuid REFERENCES public.site_visits(id) ON DELETE SET NULL,
  customer_name text,
  address text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 20,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  accepted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_status_check CHECK (status IN ('draft','sent','accepted','declined','expired'))
);
CREATE INDEX quotes_site_id_idx ON public.quotes(site_id);
CREATE INDEX quotes_site_visit_id_idx ON public.quotes(site_visit_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read quotes for their sites"
  ON public.quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quotes.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users insert quotes for their sites"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quotes.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users update quotes for their sites"
  ON public.quotes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quotes.site_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quotes.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users delete quotes for their sites"
  ON public.quotes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quotes.site_id AND s.user_id = auth.uid()));

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- quote_line_items
-- ============================================================
CREATE TABLE public.quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_line_items_quote_id_idx ON public.quote_line_items(quote_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_line_items TO authenticated;
GRANT ALL ON public.quote_line_items TO service_role;

ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage line items via their quotes"
  ON public.quote_line_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.sites s ON s.id = q.site_id
    WHERE q.id = quote_line_items.quote_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.sites s ON s.id = q.site_id
    WHERE q.id = quote_line_items.quote_id AND s.user_id = auth.uid()
  ));

CREATE TRIGGER quote_line_items_set_updated_at
  BEFORE UPDATE ON public.quote_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- jobs
-- ============================================================
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  site_visit_id uuid REFERENCES public.site_visits(id) ON DELETE SET NULL,
  customer_name text,
  address text,
  scheduled_date date,
  assigned_to text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'booked',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_status_check CHECK (status IN ('booked','in_progress','completed','invoiced','cancelled'))
);
CREATE INDEX jobs_site_id_idx ON public.jobs(site_id);
CREATE INDEX jobs_scheduled_date_idx ON public.jobs(scheduled_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read jobs for their sites"
  ON public.jobs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = jobs.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users insert jobs for their sites"
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = jobs.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users update jobs for their sites"
  ON public.jobs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = jobs.site_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = jobs.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users delete jobs for their sites"
  ON public.jobs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = jobs.site_id AND s.user_id = auth.uid()));

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
