CREATE TABLE public.quote_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT '',
  trade text NOT NULL DEFAULT '',
  business_address text NOT NULL DEFAULT '',
  business_email text NOT NULL DEFAULT '',
  business_phone text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  company_number text NOT NULL DEFAULT '',
  vat_registered boolean NOT NULL DEFAULT true,
  vat_number text NOT NULL DEFAULT '',
  vat_rate numeric NOT NULL DEFAULT 20,
  labour_rate numeric NOT NULL DEFAULT 55,
  mate_rate numeric NOT NULL DEFAULT 0,
  day_rate numeric NOT NULL DEFAULT 0,
  minimum_charge numeric NOT NULL DEFAULT 0,
  callout_fee numeric NOT NULL DEFAULT 0,
  out_of_hours_uplift_pct numeric NOT NULL DEFAULT 0,
  markup_pct numeric NOT NULL DEFAULT 20,
  mileage_rate numeric NOT NULL DEFAULT 0,
  free_travel_miles numeric NOT NULL DEFAULT 0,
  waste_disposal_fee numeric NOT NULL DEFAULT 0,
  parking_fee numeric NOT NULL DEFAULT 0,
  contingency_pct numeric NOT NULL DEFAULT 0,
  deposit_pct numeric NOT NULL DEFAULT 0,
  payment_terms_days integer NOT NULL DEFAULT 14,
  quote_validity_days integer NOT NULL DEFAULT 30,
  warranty text NOT NULL DEFAULT '',
  insurance text NOT NULL DEFAULT '',
  accreditations text NOT NULL DEFAULT '',
  preferred_merchants text NOT NULL DEFAULT 'Screwfix, Toolstation, Wickes',
  standard_inclusions text NOT NULL DEFAULT '',
  standard_exclusions text NOT NULL DEFAULT '',
  payment_methods text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  notes_to_ai text NOT NULL DEFAULT '',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_settings TO authenticated;
GRANT ALL ON public.quote_settings TO service_role;

ALTER TABLE public.quote_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read quote settings for their sites" ON public.quote_settings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quote_settings.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users insert quote settings for their sites" ON public.quote_settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quote_settings.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users update quote settings for their sites" ON public.quote_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quote_settings.site_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quote_settings.site_id AND s.user_id = auth.uid()));

CREATE POLICY "Users delete quote settings for their sites" ON public.quote_settings
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = quote_settings.site_id AND s.user_id = auth.uid()));

CREATE TRIGGER update_quote_settings_updated_at BEFORE UPDATE ON public.quote_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();