import { createFileRoute } from "@tanstack/react-router";
import { GatedPage } from "@/components/GatedPage";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, SlidersHorizontal, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import {
  getQuoteSettings,
  saveQuoteSettings,
  DEFAULT_QUOTE_SETTINGS,
  type QuoteSettings,
} from "@/lib/quote-settings.functions";

export const Route = createFileRoute("/_authenticated/business-info")({
  head: () => ({
    meta: [
      { title: "Business Info — Atyvia" },
      {
        name: "description",
        content: "Tell Atyvia how your business prices work so every AI-drafted quote is accurate.",
      },
      { property: "og:title", content: "Business Info — Atyvia" },
      {
        property: "og:description",
        content: "Labour rates, mark-up, VAT, terms and everything Atyvia needs to quote for you.",
      },
    ],
  }),
  component: QuoteSetupPage,
});

type Form = Omit<QuoteSettings, "site_id">;

function QuoteSetupPage() {
  const { selectedSiteId } = useSelectedSite();
  const fetchSettings = useServerFn(getQuoteSettings);
  const saveFn = useServerFn(saveQuoteSettings);
  const [form, setForm] = useState<Form>(DEFAULT_QUOTE_SETTINGS);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["quote-settings", selectedSiteId],
    queryFn: () => fetchSettings({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
  });

  useEffect(() => {
    if (data?.settings) {
      const { site_id: _s, ...rest } = data.settings;
      setForm({ ...DEFAULT_QUOTE_SETTINGS, ...rest });
    }
  }, [data]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!selectedSiteId) {
      toast.error("Select a site first.");
      return;
    }
    setSaving(true);
    try {
      await saveFn({ data: { siteId: selectedSiteId, settings: form } });
      toast.success("Quote settings saved — Atyvia will use these from now on.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GatedPage>
    <div className="mx-auto max-w-[1000px] space-y-6 pb-24">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SlidersHorizontal className="h-5 w-5 text-primary" /> Business Info
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One form that tells Atyvia all about your business and how you price work.

        </p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <Section title="Your business" hint="Appears at the top of every quote and invoice you send.">
            <div className="col-span-full">
              <LogoField
                siteId={selectedSiteId}
                path={form.logo_url}
                onChange={(v) => set("logo_url", v)}
              />
            </div>
            <Text label="Business name" value={form.business_name} onChange={(v) => set("business_name", v)} placeholder="A&K Plumbing & Heating Ltd" />
            <Text label="Trade / services" value={form.trade} onChange={(v) => set("trade", v)} placeholder="Plumbing, heating & bathrooms" />
            <Text label="Email" value={form.business_email} onChange={(v) => set("business_email", v)} placeholder="hello@yourbusiness.co.uk" />
            <Text label="Phone" value={form.business_phone} onChange={(v) => set("business_phone", v)} placeholder="07700 900123" />
            <Text label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="www.yourbusiness.co.uk" />
            <Text label="Company number" value={form.company_number} onChange={(v) => set("company_number", v)} placeholder="12345678" />
            <Area label="Business address" value={form.business_address} onChange={(v) => set("business_address", v)} placeholder="12 High Street, Leicester, LE1 1AA" />
          </Section>


          <Section title="VAT" hint="Controls the tax line on the quote.">
            <div className="col-span-full flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">VAT registered</p>
                <p className="text-xs text-muted-foreground">Turn off if you don't charge VAT.</p>
              </div>
              <Switch checked={form.vat_registered} onCheckedChange={(v) => set("vat_registered", v)} />
            </div>
            <Text label="VAT number" value={form.vat_number} onChange={(v) => set("vat_number", v)} placeholder="GB123456789" />
            <Num label="VAT rate (%)" value={form.vat_rate} onChange={(v) => set("vat_rate", v)} />
          </Section>

          <Section title="Labour" hint="How Atyvia prices your time.">
            <Num label="Labour rate (£/hr)" value={form.labour_rate} onChange={(v) => set("labour_rate", v)} />
            <Num label="Mate / apprentice rate (£/hr)" value={form.mate_rate} onChange={(v) => set("mate_rate", v)} />
            <Num label="Day rate (£, 0 = none)" value={form.day_rate} onChange={(v) => set("day_rate", v)} />
            <Num label="Minimum charge (£)" value={form.minimum_charge} onChange={(v) => set("minimum_charge", v)} />
            <Num label="Call-out fee (£, 0 = none)" value={form.callout_fee} onChange={(v) => set("callout_fee", v)} />
            <Num label="Out-of-hours / weekend uplift (%)" value={form.out_of_hours_uplift_pct} onChange={(v) => set("out_of_hours_uplift_pct", v)} />
          </Section>

          <Section title="Materials & on-costs" hint="Applied to parts and site costs.">
            <Num label="Materials mark-up (%)" value={form.markup_pct} onChange={(v) => set("markup_pct", v)} />
            <Text label="Preferred merchants" value={form.preferred_merchants} onChange={(v) => set("preferred_merchants", v)} placeholder="Screwfix, Toolstation, Plumbworld" />
            <Num label="Mileage rate (£/mile)" value={form.mileage_rate} onChange={(v) => set("mileage_rate", v)} />
            <Num label="Free travel radius (miles)" value={form.free_travel_miles} onChange={(v) => set("free_travel_miles", v)} />
            <Num label="Waste disposal / skip (£)" value={form.waste_disposal_fee} onChange={(v) => set("waste_disposal_fee", v)} />
            <Num label="Parking / congestion (£)" value={form.parking_fee} onChange={(v) => set("parking_fee", v)} />
            <Num label="Contingency (%)" value={form.contingency_pct} onChange={(v) => set("contingency_pct", v)} />
          </Section>

          <Section title="Payment & validity" hint="The commercial terms printed on the quote.">
            <Num label="Deposit required (%)" value={form.deposit_pct} onChange={(v) => set("deposit_pct", v)} />
            <Num label="Payment terms (days)" value={form.payment_terms_days} onChange={(v) => set("payment_terms_days", v)} />
            <Num label="Quote valid for (days)" value={form.quote_validity_days} onChange={(v) => set("quote_validity_days", v)} />
            <Text label="Payment methods" value={form.payment_methods} onChange={(v) => set("payment_methods", v)} placeholder="Bank transfer, card, cash" />
          </Section>

          <Section title="Credentials & small print" hint="Reassures the customer and protects you.">
            <Text label="Warranty / guarantee" value={form.warranty} onChange={(v) => set("warranty", v)} placeholder="12 months on workmanship" />
            <Text label="Insurance" value={form.insurance} onChange={(v) => set("insurance", v)} placeholder="£2m public liability" />
            <Text label="Accreditations" value={form.accreditations} onChange={(v) => set("accreditations", v)} placeholder="Gas Safe 123456, NICEIC" />
            <Area label="Standard inclusions" value={form.standard_inclusions} onChange={(v) => set("standard_inclusions", v)} placeholder="Labour, materials, removal of old parts, testing and clean-up." />
            <Area label="Standard exclusions" value={form.standard_exclusions} onChange={(v) => set("standard_exclusions", v)} placeholder="Making good decoration, hidden defects, asbestos removal, scaffolding." />
            <Area label="Terms & conditions" value={form.terms} onChange={(v) => set("terms", v)} placeholder="Prices exclude unforeseen works. Access required between 8am–5pm…" />
            <Area label="Anything else Atyvia should know when quoting" value={form.notes_to_ai} onChange={(v) => set("notes_to_ai", v)} placeholder="Always add half an hour for parking in the city centre. Never quote for gas work." />
          </Section>

          <div className="sticky bottom-4 flex justify-end">
            <Button className="gap-2 shadow-lg" onClick={save} disabled={saving || !selectedSiteId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save quote settings
            </Button>
          </div>
        </>
      )}
    </div>
    </GatedPage>
  );
}

/** Upload / replace the company logo used on quotes and invoices. */
function LogoField({
  siteId,
  path,
  onChange,
}: {
  siteId: string | null;
  path: string;
  onChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const preview = path && siteId ? `/api/public/branding/logo/${siteId}?v=${encodeURIComponent(path)}` : null;

  const upload = async (file: File) => {
    if (!siteId) {
      toast.error("Select a site first.");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.type)) {
      toast.error("Use a PNG, JPG, WEBP or SVG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Keep the logo under 2MB.");
      return;
    }
    setBusy(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const objectPath = `${siteId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("branding")
        .upload(objectPath, file, { contentType: file.type, upsert: true });
      if (error) throw new Error(error.message);
      onChange(objectPath);
      toast.success("Logo uploaded — hit Save to use it on your paperwork.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload that logo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Company logo</Label>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
          {preview ? (
            <img src={preview} alt="Company logo" className="max-h-14 max-w-24 object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">
            Used at the top of your invoices and quotes. PNG, JPG, WEBP or SVG, up to 2MB.
          </p>
          <div className="flex gap-2">
            <label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (f) void upload(f);
                }}
              />
              <Button asChild variant="outline" size="sm" disabled={busy}>
                <span className="cursor-pointer gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {path ? "Replace logo" : "Upload logo"}
                </span>
              </Button>
            </label>
            {path && (
              <Button variant="ghost" size="sm" onClick={() => onChange("")} disabled={busy}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} placeholder={placeholder} maxLength={200} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="col-span-full space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={3} value={value} placeholder={placeholder} maxLength={2000} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} step="0.5" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
