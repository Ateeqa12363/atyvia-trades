CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  invoice_number text NOT NULL DEFAULT '',
  customer_name text,
  customer_email text,
  address text,
  phone text,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  payment_link text,
  due_date date,
  notes text,
  approved_at timestamptz,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invoices_job_id_key ON public.invoices(job_id) WHERE job_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read invoices for their sites" ON public.invoices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = invoices.site_id AND s.user_id = auth.uid()));
CREATE POLICY "Users insert invoices for their sites" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = invoices.site_id AND s.user_id = auth.uid()));
CREATE POLICY "Users update invoices for their sites" ON public.invoices FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = invoices.site_id AND s.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = invoices.site_id AND s.user_id = auth.uid()));
CREATE POLICY "Users delete invoices for their sites" ON public.invoices FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = invoices.site_id AND s.user_id = auth.uid()));

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_items TO authenticated;
GRANT ALL ON public.invoice_line_items TO service_role;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage invoice line items via their invoices" ON public.invoice_line_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.invoices i JOIN public.sites s ON s.id = i.site_id WHERE i.id = invoice_line_items.invoice_id AND s.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i JOIN public.sites s ON s.id = i.site_id WHERE i.id = invoice_line_items.invoice_id AND s.user_id = auth.uid()));

CREATE TRIGGER update_invoice_line_items_updated_at BEFORE UPDATE ON public.invoice_line_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();