
-- 1) sites table
CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  retell_agent_id text,
  phone_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sites - select"
  ON public.sites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own sites - insert"
  ON public.sites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own sites - update"
  ON public.sites FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own sites - delete"
  ON public.sites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Webhook (service_role) needs to read sites to resolve site_id for incoming calls.
-- service_role already has ALL grants and bypasses RLS.

CREATE INDEX sites_user_id_idx ON public.sites(user_id);
CREATE INDEX sites_retell_agent_id_idx ON public.sites(retell_agent_id) WHERE retell_agent_id IS NOT NULL;
CREATE INDEX sites_phone_number_idx ON public.sites(phone_number) WHERE phone_number IS NOT NULL;

CREATE TRIGGER trg_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) profiles.selected_site_id
ALTER TABLE public.profiles
  ADD COLUMN selected_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

-- 3) calls.site_id (nullable; unassigned calls remain)
ALTER TABLE public.calls
  ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE INDEX calls_site_id_idx ON public.calls(site_id);

-- Let signed-in users read their own site's calls (in addition to the existing public demo policy).
CREATE POLICY "Users can read calls for their own sites"
  ON public.calls FOR SELECT TO authenticated
  USING (
    site_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = calls.site_id AND s.user_id = auth.uid())
  );

-- 4) Auto-provision a default site for new signups + set as selected
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_site_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );

  INSERT INTO public.sites (user_id, name)
  VALUES (NEW.id, 'My site')
  RETURNING id INTO new_site_id;

  UPDATE public.profiles
     SET selected_site_id = new_site_id
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 5) Backfill: one default site per existing user; set as selected
WITH new_sites AS (
  INSERT INTO public.sites (user_id, name)
  SELECT p.id, 'My site'
  FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.user_id = p.id)
  RETURNING id, user_id
)
UPDATE public.profiles p
   SET selected_site_id = ns.id
  FROM new_sites ns
 WHERE ns.user_id = p.id
   AND p.selected_site_id IS NULL;
