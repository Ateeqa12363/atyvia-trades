-- =========================================================
-- Phase 2: roles, notifications, message log, reminders,
-- job photos, persistent customers, aggregation helpers
-- =========================================================

-- ---------- Roles ----------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can grant roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can revoke roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- Site ownership helper ----------
CREATE OR REPLACE FUNCTION public.owns_site(_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = _site_id AND s.user_id = auth.uid()
  );
$$;

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Message log ----------
CREATE TABLE IF NOT EXISTS public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  channel text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  recipient text,
  subject text,
  body text,
  template text,
  status text NOT NULL DEFAULT 'queued',
  provider text,
  provider_ref text,
  error text,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  site_visit_id uuid REFERENCES public.site_visits(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.message_log TO authenticated;
GRANT ALL ON public.message_log TO service_role;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their message log"
  ON public.message_log FOR SELECT TO authenticated
  USING (public.owns_site(site_id));

CREATE INDEX IF NOT EXISTS message_log_site_created_idx
  ON public.message_log (site_id, created_at DESC);

CREATE TRIGGER message_log_set_updated_at
  BEFORE UPDATE ON public.message_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Reminders ----------
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  kind text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  recipient text,
  message text,
  sent_at timestamptz,
  error text,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  site_visit_id uuid REFERENCES public.site_visits(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their reminders"
  ON public.reminders FOR ALL TO authenticated
  USING (public.owns_site(site_id))
  WITH CHECK (public.owns_site(site_id));

CREATE INDEX IF NOT EXISTS reminders_due_idx
  ON public.reminders (status, due_at);

CREATE TRIGGER reminders_set_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Job photos ----------
CREATE TABLE IF NOT EXISTS public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  site_visit_id uuid REFERENCES public.site_visits(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  kind text NOT NULL DEFAULT 'progress',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_photos TO authenticated;
GRANT ALL ON public.job_photos TO service_role;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their job photos"
  ON public.job_photos FOR ALL TO authenticated
  USING (public.owns_site(site_id))
  WITH CHECK (public.owns_site(site_id));

CREATE INDEX IF NOT EXISTS job_photos_job_idx ON public.job_photos (job_id, position);

CREATE TRIGGER job_photos_set_updated_at
  BEFORE UPDATE ON public.job_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documents bucket: users may only touch files under their own user id folder.
CREATE POLICY "Users read their own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload their own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update their own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete their own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Persistent customers ----------
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text,
  phone_key text,
  email text,
  address text,
  town text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their customers"
  ON public.customers FOR ALL TO authenticated
  USING (public.owns_site(site_id))
  WITH CHECK (public.owns_site(site_id));

CREATE UNIQUE INDEX IF NOT EXISTS customers_site_phone_key_idx
  ON public.customers (site_id, phone_key) WHERE phone_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_site_name_idx
  ON public.customers (site_id, lower(name));

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.quotes      ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.jobs        ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- ---------- Cleanup ----------
ALTER TABLE public.invoices DROP COLUMN IF EXISTS payment_link;

-- ---------- Aggregation helpers ----------
-- Dashboard month summary in a single round trip.
CREATE OR REPLACE FUNCTION public.dashboard_summary(
  _site_id uuid,
  _from timestamptz,
  _to timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'calls', (SELECT count(*) FROM calls c
              WHERE c.site_id = _site_id AND c.start_time >= _from AND c.start_time < _to),
    'booked_calls', (SELECT count(*) FROM calls c
              WHERE c.site_id = _site_id AND c.start_time >= _from AND c.start_time < _to
                AND c.booked_appointment IS TRUE),
    'visits', (SELECT count(*) FROM site_visits v
              WHERE v.site_id = _site_id AND v.scheduled_at >= _from AND v.scheduled_at < _to),
    'quotes_sent', (SELECT count(*) FROM quotes q
              WHERE q.site_id = _site_id AND q.sent_at >= _from AND q.sent_at < _to),
    'quotes_accepted', (SELECT count(*) FROM quotes q
              WHERE q.site_id = _site_id AND q.accepted_at >= _from AND q.accepted_at < _to),
    'quotes_value', (SELECT COALESCE(sum(q.total), 0) FROM quotes q
              WHERE q.site_id = _site_id AND q.created_at >= _from AND q.created_at < _to),
    'jobs', (SELECT count(*) FROM jobs j
              WHERE j.site_id = _site_id AND j.scheduled_date >= _from::date AND j.scheduled_date < _to::date),
    'jobs_completed', (SELECT count(*) FROM jobs j
              WHERE j.site_id = _site_id AND j.status IN ('completed','invoiced')
                AND j.scheduled_date >= _from::date AND j.scheduled_date < _to::date),
    'invoiced', (SELECT COALESCE(sum(i.total), 0) FROM invoices i
              WHERE i.site_id = _site_id AND i.created_at >= _from AND i.created_at < _to),
    'paid', (SELECT COALESCE(sum(i.total), 0) FROM invoices i
              WHERE i.site_id = _site_id AND i.status = 'paid'
                AND COALESCE(i.paid_at, i.created_at) >= _from
                AND COALESCE(i.paid_at, i.created_at) < _to),
    'outstanding', (SELECT COALESCE(sum(i.total), 0) FROM invoices i
              WHERE i.site_id = _site_id AND i.status <> 'paid'
                AND i.created_at >= _from AND i.created_at < _to)
  );
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_summary(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- Customer book aggregated SQL-side (grouped by phone digits, else name).
CREATE OR REPLACE FUNCTION public.customer_book(_site_id uuid)
RETURNS TABLE (
  group_key text,
  name text,
  phone text,
  email text,
  address text,
  job_count bigint,
  completed_count bigint,
  revenue numeric,
  paid_revenue numeric,
  first_job date,
  last_job date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH j AS (
    SELECT
      COALESCE(
        NULLIF(right(regexp_replace(COALESCE(jb.phone, ''), '\D', '', 'g'), 9), ''),
        lower(trim(COALESCE(jb.customer_name, 'unknown')))
      ) AS group_key,
      jb.id,
      jb.customer_name,
      jb.phone,
      jb.address,
      jb.status,
      jb.price,
      jb.scheduled_date,
      (SELECT COALESCE(sum(i.total), 0) FROM invoices i WHERE i.job_id = jb.id) AS invoiced,
      (SELECT COALESCE(sum(i.total), 0) FROM invoices i WHERE i.job_id = jb.id AND i.status = 'paid') AS paid
    FROM jobs jb
    WHERE jb.site_id = _site_id
  )
  SELECT
    j.group_key,
    (array_agg(j.customer_name ORDER BY length(COALESCE(j.customer_name, '')) DESC))[1] AS name,
    (array_agg(j.phone ORDER BY j.phone NULLS LAST))[1] AS phone,
    (SELECT q.customer_email FROM quotes q
      WHERE q.site_id = _site_id AND q.customer_email IS NOT NULL
        AND right(regexp_replace(COALESCE(q.phone, ''), '\D', '', 'g'), 9) = j.group_key
      LIMIT 1) AS email,
    (array_agg(j.address ORDER BY j.scheduled_date DESC NULLS LAST))[1] AS address,
    count(*) FILTER (WHERE j.status <> 'cancelled') AS job_count,
    count(*) FILTER (WHERE j.status IN ('completed', 'invoiced')) AS completed_count,
    COALESCE(sum(CASE WHEN j.status <> 'cancelled'
      THEN (CASE WHEN j.invoiced > 0 THEN j.invoiced ELSE j.price END) ELSE 0 END), 0) AS revenue,
    COALESCE(sum(j.paid), 0) AS paid_revenue,
    min(j.scheduled_date) AS first_job,
    max(j.scheduled_date) AS last_job
  FROM j
  GROUP BY j.group_key
  ORDER BY revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.customer_book(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_site(uuid) TO authenticated, service_role;
