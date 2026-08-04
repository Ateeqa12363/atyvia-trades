-- Backfill existing calls to the primary demo site so KPIs/live feed reconnect with the calls log.
UPDATE public.calls
   SET site_id = 'd4b44674-958c-4430-89e8-ac13712f5d44'
 WHERE site_id IS NULL;