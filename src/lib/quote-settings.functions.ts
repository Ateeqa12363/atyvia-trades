import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuoteSettings = {
  site_id: string;
  business_name: string;
  logo_url: string;

  trade: string;
  business_address: string;
  business_email: string;
  business_phone: string;
  website: string;
  company_number: string;
  vat_registered: boolean;
  vat_number: string;
  vat_rate: number;
  labour_rate: number;
  mate_rate: number;
  day_rate: number;
  minimum_charge: number;
  callout_fee: number;
  out_of_hours_uplift_pct: number;
  markup_pct: number;
  mileage_rate: number;
  free_travel_miles: number;
  waste_disposal_fee: number;
  parking_fee: number;
  contingency_pct: number;
  deposit_pct: number;
  payment_terms_days: number;
  quote_validity_days: number;
  warranty: string;
  insurance: string;
  accreditations: string;
  preferred_merchants: string;
  standard_inclusions: string;
  standard_exclusions: string;
  payment_methods: string;
  terms: string;
  notes_to_ai: string;
  onboarding_completed: boolean;
};

export const DEFAULT_QUOTE_SETTINGS: Omit<QuoteSettings, "site_id"> = {
  business_name: "",
  logo_url: "",

  trade: "",
  business_address: "",
  business_email: "",
  business_phone: "",
  website: "",
  company_number: "",
  vat_registered: true,
  vat_number: "",
  vat_rate: 20,
  labour_rate: 55,
  mate_rate: 0,
  day_rate: 0,
  minimum_charge: 0,
  callout_fee: 0,
  out_of_hours_uplift_pct: 0,
  markup_pct: 20,
  mileage_rate: 0,
  free_travel_miles: 0,
  waste_disposal_fee: 0,
  parking_fee: 0,
  contingency_pct: 0,
  deposit_pct: 0,
  payment_terms_days: 14,
  quote_validity_days: 30,
  warranty: "",
  insurance: "",
  accreditations: "",
  preferred_merchants: "Screwfix, Toolstation, Wickes",
  standard_inclusions: "",
  standard_exclusions: "",
  payment_methods: "",
  terms: "",
  notes_to_ai: "",
  onboarding_completed: false,
};

export const getQuoteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }): Promise<{ settings: QuoteSettings | null }> => {
    if (!data.siteId) return { settings: null };
    const { data: row, error } = await context.supabase
      .from("quote_settings")
      .select("*")
      .eq("site_id", data.siteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      settings: row
        ? ({ ...DEFAULT_QUOTE_SETTINGS, ...row } as QuoteSettings)
        : ({ ...DEFAULT_QUOTE_SETTINGS, site_id: data.siteId } as QuoteSettings),
    };
  });

export const saveQuoteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string; settings: Partial<QuoteSettings> }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { site_id: _ignored, ...rest } = data.settings as Record<string, unknown> & {
      site_id?: string;
    };
    const payload = {
      ...rest,
      site_id: data.siteId,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await context.supabase
      .from("quote_settings")
      .upsert(payload, { onConflict: "site_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
