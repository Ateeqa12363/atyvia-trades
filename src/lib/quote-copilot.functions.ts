import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DraftQuote, DraftQuoteLine } from "@/lib/ai-quote.functions";

export type PricingSettings = {
  labour_rate: number; // £ per hour
  markup_pct: number; // % added to materials
  callout_fee: number; // £, 0 = none
  vat_rate: number; // %
};

export const DEFAULT_PRICING: PricingSettings = {
  labour_rate: 55,
  markup_pct: 20,
  callout_fee: 0,
  vat_rate: 20,
};

type SettingsRow = Record<string, unknown> | null;

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pricingFrom(s: SettingsRow): PricingSettings {
  if (!s) return DEFAULT_PRICING;
  const vatRegistered = s.vat_registered !== false;
  return {
    labour_rate: num(s.labour_rate, DEFAULT_PRICING.labour_rate) || DEFAULT_PRICING.labour_rate,
    markup_pct: num(s.markup_pct, DEFAULT_PRICING.markup_pct),
    callout_fee: num(s.callout_fee, 0),
    vat_rate: vatRegistered ? num(s.vat_rate, DEFAULT_PRICING.vat_rate) : 0,
  };
}

/** Turns the Business Info row into a plain-English profile the model must follow. */
function profileFrom(s: SettingsRow): string {
  if (!s) return "";
  const lines: string[] = [];
  const add = (label: string, v: unknown) => {
    if (v === "" || v === 0 || v === null || v === undefined || v === false) return;
    lines.push(`- ${label}: ${v}`);
  };
  add("Business", s.business_name);
  add("Trade", s.trade);
  add(
    "VAT",
    s.vat_registered !== false ? `registered (${num(s.vat_rate, 20)}%)` : "not registered — never add VAT",
  );
  add("Mate/apprentice rate £/hr", s.mate_rate);
  add("Day rate £", s.day_rate);
  add("Minimum charge £", s.minimum_charge);
  add("Out-of-hours/weekend uplift %", s.out_of_hours_uplift_pct);
  add("Mileage £/mile beyond free radius", s.mileage_rate);
  add("Free travel radius (miles)", s.free_travel_miles);
  add("Waste disposal/skip £ (add as a line when waste is generated)", s.waste_disposal_fee);
  add("Parking/congestion £", s.parking_fee);
  add("Contingency % (add as its own line)", s.contingency_pct);
  add("Deposit %", s.deposit_pct);
  add("Payment terms (days)", s.payment_terms_days);
  add("Quote valid for (days)", s.quote_validity_days);
  add("Preferred merchants", s.preferred_merchants);
  add("Warranty", s.warranty);
  add("Insurance", s.insurance);
  add("Accreditations", s.accreditations);
  add("Standard inclusions", s.standard_inclusions);
  add("Standard exclusions", s.standard_exclusions);
  add("Payment methods", s.payment_methods);
  add("Terms", s.terms);
  add("Extra instructions from the tradesperson", s.notes_to_ai);
  lines.push(
    "- In notes, mention what's included, exclusions, deposit, payment terms, warranty and how long the quote is valid.",
  );
  return lines.join("\n");
}

function systemPrompt(p: PricingSettings, profile: string, priceContext: string, merchants: string) {
  return `You are an estimating assistant for a UK trades business (plumbing, heating, electrical, general building).
The tradesperson describes a job (dictated or typed) and may attach photos of the work. You produce a DRAFT quote for them to review.

Business pricing rules — you MUST use these:
- Labour rate: £${p.labour_rate} per hour (ex VAT). Estimate hours realistically and use this rate.
- Materials mark-up: add ${p.markup_pct}% on top of trade/retail part cost.
- Call-out fee: ${p.callout_fee > 0 ? `£${p.callout_fee} as its own line item` : "none — do not add a call-out line"}.
- All prices EXCLUDE VAT (VAT of ${p.vat_rate}% is added by the system afterwards).

Parts pricing:
- Preferred merchants: ${merchants || "Screwfix, Toolstation, Wickes"}. Price parts from those merchants.
${priceContext ? `- LIVE MERCHANT SEARCH RESULTS (use these prices where they match the part; they were fetched from the web just now):\n${priceContext}` : "- No live search results were available; use your best up-to-date knowledge of those merchants' catalogues."}
- Name the part clearly (brand/size/spec) and note the merchant, e.g. "Grohe Bau basin mixer tap (Screwfix) inc. ${p.markup_pct}% mark-up".
- Quantity is the number of units; unit_price is per unit AFTER mark-up.

Also:
- Only quote work actually described. Do not invent extra work.
- If photos are attached, use them to judge condition, size and access.
- Pull the customer's name, email and job address out of the brief if given; otherwise null.
- notes: one short paragraph to send the customer explaining what's included and any assumptions.
- summary: one sentence describing the job for the tradesperson.
${profile ? `\nBusiness profile and quoting rules set by the tradesperson (follow these closely):\n${profile}\n` : ""}
Return JSON only.`;
}

const DRAFT_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "draft_quote",
    schema: {
      type: "object",
      properties: {
        customer_name: { type: ["string", "null"] },
        customer_email: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        summary: { type: ["string", "null"] },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
            },
            required: ["description", "quantity", "unit_price"],
            additionalProperties: false,
          },
        },
      },
      required: ["customer_name", "customer_email", "address", "notes", "summary", "line_items"],
      additionalProperties: false,
    },
  },
};

const PARTS_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "parts_queries",
    schema: {
      type: "object",
      properties: {
        queries: { type: "array", items: { type: "string" } },
      },
      required: ["queries"],
      additionalProperties: false,
    },
  },
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGateway(apiKey: string, body: Record<string, unknown>) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings → Plans & credits.");
  if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(raw: string): Partial<T> {
  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Partial<T>;
      } catch {
        /* ignore */
      }
    }
    return {};
  }
}

/** Transcribe a dictated brief (base64 audio) into text. */
export const transcribeBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audioBase64: string; mimeType: string }) => data)
  .handler(async ({ data }): Promise<{ text: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength < 2048) throw new Error("That recording was empty — please try again.");

    const ext =
      ({
        "audio/wav": "wav",
        "audio/webm": "webm",
        "audio/mp4": "mp4",
        "audio/mpeg": "mp3",
      } as Record<string, string>)[data.mimeType.split(";")[0]] ?? "wav";

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: data.mimeType }), `brief.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings → Plans & credits.");
    if (!res.ok) throw new Error(`Transcription failed [${res.status}]: ${await res.text()}`);

    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });

/**
 * Draft a quote from a dictated/typed brief plus optional photos.
 * Business Info is read live from the database, and parts are priced with a
 * live web search of the tradesperson's preferred merchants.
 */
export const draftQuoteFromBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      brief: string;
      images?: string[];
      siteId?: string | null;
    }) => data,
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      draft: DraftQuote;
      pricing: PricingSettings;
      sources: Array<{ title: string; url: string }>;
    }> => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
      if (!data.brief.trim() && !(data.images ?? []).length) {
        throw new Error("Describe the job (or attach a photo) first.");
      }

      // --- Business Info, read fresh on every draft ---
      let settings: SettingsRow = null;
      if (data.siteId) {
        const { data: row } = await context.supabase
          .from("quote_settings")
          .select("*")
          .eq("site_id", data.siteId)
          .maybeSingle();
        settings = (row as SettingsRow) ?? null;
      }
      const pricing = pricingFrom(settings);
      const profile = profileFrom(settings);
      const merchants = String((settings?.preferred_merchants as string) ?? "Screwfix, Toolstation, Wickes");

      const briefText = data.brief.trim() || "See attached photos of the job.";
      const content: Array<Record<string, unknown>> = [
        { type: "text", text: briefText },
        ...(data.images ?? []).slice(0, 6).map((url) => ({
          type: "image_url",
          image_url: { url },
        })),
      ];

      // --- Step 1: work out which parts to price up ---
      let queries: string[] = [];
      try {
        const raw = await callGateway(apiKey, {
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "system",
              content: `You are a UK trades estimator. From the job brief (and photos), list the specific materials/parts that need buying so their current prices can be looked up at ${merchants}. Return 1-6 short product search phrases (brand/size/spec where sensible, e.g. "basin mixer tap chrome", "15mm copper pipe 3m", "Worcester Bosch 25i combi boiler"). No labour, no fees. Return JSON only.`,
            },
            { role: "user", content },
          ],
          response_format: PARTS_SCHEMA,
        });
        const parsed = parseJson<{ queries: string[] }>(raw);
        queries = Array.isArray(parsed.queries) ? parsed.queries.filter((q) => typeof q === "string") : [];
      } catch (e) {
        console.warn("[quote-assist] parts query step failed", e);
      }

      // --- Step 2: live merchant price search ---
      let priceContext = "";
      let sources: Array<{ title: string; url: string }> = [];
      if (queries.length) {
        try {
          const { searchParts } = await import("@/lib/parts-search.server");
          const { results } = await searchParts(queries, merchants);
          if (results.length) {
            priceContext = results
              .map((r) => `  • [${r.query}] ${r.title} — ${r.snippet} (${r.url})`)
              .join("\n");
            sources = results
              .filter((r) => r.url)
              .map((r) => ({ title: r.title || r.url, url: r.url }))
              .slice(0, 8);
          }
        } catch (e) {
          console.warn("[quote-assist] parts search failed", e);
        }
      }

      // --- Step 3: full draft quote ---
      const raw = await callGateway(apiKey, {
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: systemPrompt(pricing, profile, priceContext, merchants) },
          { role: "user", content },
        ],
        response_format: DRAFT_SCHEMA,
      });

      const parsed = parseJson<DraftQuote>(raw);
      const items = (Array.isArray(parsed.line_items) ? parsed.line_items : []) as DraftQuoteLine[];
      return {
        pricing,
        sources,
        draft: {
          customer_name: parsed.customer_name ?? null,
          customer_email: parsed.customer_email ?? null,
          phone: (parsed as { phone?: string | null }).phone ?? null,

          address: parsed.address ?? null,
          notes: parsed.notes ?? null,
          summary: parsed.summary ?? null,
          line_items: items
            .filter((it) => it && typeof it.description === "string")
            .map((it) => ({
              description: it.description,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) || 0,
            })),
        },
      };
    },
  );
