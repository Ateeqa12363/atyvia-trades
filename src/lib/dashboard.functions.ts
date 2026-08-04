import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardSummary = {
  calls: number;
  booked_calls: number;
  visits: number;
  quotes_sent: number;
  quotes_accepted: number;
  quotes_value: number;
  jobs: number;
  jobs_completed: number;
  invoiced: number;
  paid: number;
  outstanding: number;
};

const EMPTY: DashboardSummary = {
  calls: 0,
  booked_calls: 0,
  visits: 0,
  quotes_sent: 0,
  quotes_accepted: 0,
  quotes_value: 0,
  jobs: 0,
  jobs_completed: 0,
  invoiced: 0,
  paid: 0,
  outstanding: 0,
};

/**
 * Whole-month dashboard figures aggregated in the database — one round trip
 * instead of pulling every call, quote, job and invoice into the browser.
 */
export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null; from: string; to: string }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { summary: EMPTY };
    const { data: row, error } = await context.supabase.rpc("dashboard_summary", {
      _site_id: data.siteId,
      _from: data.from,
      _to: data.to,
    });
    if (error) throw new Error(error.message);
    return { summary: { ...EMPTY, ...((row ?? {}) as Partial<DashboardSummary>) } };
  });

export type CustomerBookRow = {
  group_key: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  job_count: number;
  completed_count: number;
  revenue: number;
  paid_revenue: number;
  first_job: string | null;
  last_job: string | null;
};

/** Customer totals grouped and summed in the database (fast list view). */
export const getCustomerBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { rows: [] as CustomerBookRow[] };
    const { data: rows, error } = await context.supabase.rpc("customer_book", {
      _site_id: data.siteId,
    });
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as CustomerBookRow[] };
  });
