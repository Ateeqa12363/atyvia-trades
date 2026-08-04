import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DraftQuoteLine = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type DraftQuote = {
  customer_name: string | null;
  customer_email: string | null;
  /** Always carried through from the call — the number to ring the customer on. */
  phone: string | null;
  address: string | null;
  notes: string | null;
  summary: string | null;
  line_items: DraftQuoteLine[];
};


const SYSTEM_PROMPT = `You are an estimating assistant for a UK trades business (plumbing, heating, electrical, general building).
You read the transcript of a phone call between the business's AI receptionist and a customer, and you produce a DRAFT quote for the tradesperson to review.

Rules:
- Only quote work that the customer actually asked about in the call.
- Break the job into sensible line items (labour, materials, call-out, etc.).
- Prices are in GBP, EXCLUDING VAT (VAT is added separately by the system).
- Use realistic UK market rates. If you are unsure of a price, give a sensible mid-range estimate rather than 0.
- quantity is a number (hours, units, or 1 for a fixed price item).
- Pull the customer's name, email and job address out of the call if they were given; otherwise use null.
- notes: one short paragraph the tradesperson can send to the customer explaining what's included and any assumptions.
- summary: one sentence describing the job, for the tradesperson.
Return JSON only.`;

function transcriptToText(t: unknown): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    return t
      .map((turn) => {
        const r = (turn as { role?: string }).role ?? "";
        const c = (turn as { content?: string }).content ?? "";
        return `${r}: ${c}`;
      })
      .join("\n");
  }
  return JSON.stringify(t);
}

/**
 * AI Copilot — reads a call and returns a draft quote.
 * Nothing is written to the database; the tradesperson reviews and approves first.
 */
export const draftQuoteFromCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { callId: string }) => data)
  .handler(async ({ data, context }): Promise<{ draft: DraftQuote }> => {
    const { data: call, error } = await context.supabase
      .from("calls")
      .select("id, caller_name, from_number, summary, transcript, custom_data")
      .eq("id", data.callId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!call) throw new Error("Call not found");

    const transcript = transcriptToText(call.transcript);
    if (!transcript && !call.summary) {
      throw new Error("This call has no transcript yet — nothing to quote from.");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

    const userContent = [
      call.caller_name ? `Caller name: ${call.caller_name}` : "",
      call.from_number ? `Caller number: ${call.from_number}` : "",
      call.custom_data ? `Structured data captured on the call: ${JSON.stringify(call.custom_data)}` : "",
      call.summary ? `Call summary: ${call.summary}` : "",
      transcript ? `Transcript:\n${transcript}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
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
        },
      }),
    });

    if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings → Plans & credits.");
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI request failed [${res.status}]: ${body}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: Partial<DraftQuote> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          /* fall through */
        }
      }
    }

    const items = Array.isArray(parsed.line_items) ? parsed.line_items : [];
    const draft: DraftQuote = {
      customer_name: parsed.customer_name ?? call.caller_name ?? null,
      customer_email: parsed.customer_email ?? null,
      phone:
        call.from_number ??
        (await import("@/lib/phone-extract")).extractCallerPhone(call.transcript) ??
        null,

      address: parsed.address ?? null,
      notes: parsed.notes ?? null,
      summary: parsed.summary ?? call.summary ?? null,
      line_items: items
        .filter((it) => it && typeof it.description === "string")
        .map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
        })),
    };

    return { draft };
  });

/**
 * Approve a copilot draft — creates the real quote + line items.
 */
export const createQuoteFromDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      siteId: string;
      customer_name: string | null;
      customer_email: string | null;
      phone?: string | null;
      address: string | null;
      notes: string | null;
      vat_rate?: number;
      items: DraftQuoteLine[];
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const vatRate = Number(data.vat_rate ?? 20);
    const subtotal = Number(
      data.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0).toFixed(2),
    );
    const total = Number((subtotal * (1 + vatRate / 100)).toFixed(2));

    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(24).toString("hex");

    const { data: q, error } = await context.supabase
      .from("quotes")
      .insert({
        site_id: data.siteId,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        phone: data.phone ?? null,
        address: data.address,
        notes: data.notes,

        subtotal,
        vat_rate: vatRate,
        total,
        status: "draft",
        respond_token: token,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.items.length) {
      const rows = data.items.map((it, i) => ({
        quote_id: q.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: Number((Number(it.quantity) * Number(it.unit_price)).toFixed(2)),
        position: i,
      }));
      const ins = await context.supabase.from("quote_line_items").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }

    return { id: q.id, subtotal, total };
  });

/**
 * Draft a quote for an existing quote record (e.g. one created from a completed
 * site visit). Uses the business's own Business Info (rates, mark-up, VAT, terms)
 * plus similar past jobs as pricing precedent, then writes draft line items.
 */
export const draftQuoteForQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { quoteId: string; brief?: string; images?: string[] }) => data)
  .handler(async ({ data, context }) => {
    const { data: quote, error } = await context.supabase
      .from("quotes")
      .select("id, site_id, site_visit_id, customer_name, address, phone, notes, vat_rate, status")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quote) throw new Error("Quote not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

    // Pull through everything already known about this job: the site-visit
    // record and, where it came from a phone enquiry, the call itself.
    let visitContext = "";
    if (quote.site_visit_id) {
      const { data: visit } = await context.supabase
        .from("site_visits")
        .select("notes, address, phone, customer_name, scheduled_at, call_id")
        .eq("id", quote.site_visit_id)
        .maybeSingle();
      if (visit) {
        visitContext = [
          visit.notes ? `Site visit notes (from the booking):\n${visit.notes}` : "",
          visit.address && visit.address !== quote.address ? `Visit address: ${visit.address}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        if (visit.call_id) {
          const { data: call } = await context.supabase
            .from("calls")
            .select("summary, transcript, appointment_notes, custom_data")
            .eq("id", visit.call_id)
            .maybeSingle();
          if (call) {
            const transcript =
              typeof call.transcript === "string"
                ? call.transcript
                : Array.isArray(call.transcript)
                  ? (call.transcript as Array<{ role?: string; content?: string }>)
                      .map((t) => `${t.role ?? ""}: ${t.content ?? ""}`)
                      .join("\n")
                  : "";
            visitContext = [
              visitContext,
              call.summary ? `What the customer described on the phone:\n${call.summary}` : "",
              call.appointment_notes ? `Booking notes from the call: ${call.appointment_notes}` : "",
              transcript ? `Call transcript:\n${transcript.slice(0, 8000)}` : "",
            ]
              .filter(Boolean)
              .join("\n\n");
          }
        }
      }
    }


    const [{ data: settings }, { data: past }] = await Promise.all([
      context.supabase.from("quote_settings").select("*").eq("site_id", quote.site_id).maybeSingle(),
      context.supabase
        .from("quotes")
        .select("id, customer_name, address, notes, subtotal, status, created_at")
        .eq("site_id", quote.site_id)
        .in("status", ["sent", "accepted"])
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const pastIds = (past ?? []).map((p) => p.id);
    const { data: pastItems } = pastIds.length
      ? await context.supabase
          .from("quote_line_items")
          .select("quote_id, description, quantity, unit_price")
          .in("quote_id", pastIds)
      : { data: [] as Array<{ quote_id: string; description: string; quantity: number; unit_price: number }> };

    const precedent = (past ?? [])
      .map((p) => {
        const items = (pastItems ?? []).filter((li) => li.quote_id === p.id);
        if (!items.length) return "";
        return `- ${p.notes ? p.notes.slice(0, 160) : "Past job"} (${p.status}):\n${items
          .map((li) => `    · ${li.description} — ${li.quantity} × £${Number(li.unit_price).toFixed(2)}`)
          .join("\n")}`;
      })
      .filter(Boolean)
      .join("\n");

    const businessInfo = settings
      ? Object.entries(settings)
          .filter(([k, v]) => !["id", "site_id", "created_at", "updated_at"].includes(k) && v !== null && v !== "")
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join("\n")
      : "No business info captured yet — use sensible UK trade rates.";

    const userContent = [
      `Job to quote:`,
      quote.customer_name ? `Customer: ${quote.customer_name}` : "",
      quote.address ? `Address: ${quote.address}` : "",
      quote.phone ? `Phone: ${quote.phone}` : "",
      quote.notes ? `Visit notes / job description:\n${quote.notes}` : "",
      visitContext,
      data.brief?.trim()
        ? `Tradesperson's dictated notes from the visit (highest priority — these describe the actual work):\n${data.brief.trim()}`
        : "",
      (data.images ?? []).length ? "Photos of the job are attached." : "",
      "",
      `Business info (use these rates, mark-up and terms):\n${businessInfo}`,
      precedent ? `\nSimilar past quotes from this business (use as pricing precedent):\n${precedent}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const messageContent: Array<Record<string, unknown>> = [
      { type: "text", text: userContent },
      ...(data.images ?? []).slice(0, 6).map((url) => ({
        type: "image_url",
        image_url: { url },
      })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content: `${SYSTEM_PROMPT}\n\nYou are quoting after a completed site visit. Apply the business's own labour/day rates, mark-up on materials, minimum charge, call-out fee and travel rules from the business info. Prices EXCLUDE VAT. Follow the pricing patterns in the past quotes where the work is similar.`,
          },
          { role: "user", content: messageContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "draft_quote",
            schema: {
              type: "object",
              properties: {
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
              required: ["notes", "summary", "line_items"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings → Plans & credits.");
    if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: { notes?: string | null; summary?: string | null; line_items?: DraftQuoteLine[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const items = (Array.isArray(parsed.line_items) ? parsed.line_items : [])
      .filter((it) => it && typeof it.description === "string")
      .map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
      }));
    if (!items.length) throw new Error("The AI couldn't work out any line items — add more detail to the visit notes.");

    await context.supabase.from("quote_line_items").delete().eq("quote_id", quote.id);
    const rows = items.map((it, i) => ({
      quote_id: quote.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: Number((it.quantity * it.unit_price).toFixed(2)),
      position: i,
    }));
    const ins = await context.supabase.from("quote_line_items").insert(rows);
    if (ins.error) throw new Error(ins.error.message);

    const subtotal = Number(rows.reduce((s, r) => s + r.line_total, 0).toFixed(2));
    const vatRate = Number(quote.vat_rate ?? 20);
    const total = Number((subtotal * (1 + vatRate / 100)).toFixed(2));
    const upd = await context.supabase
      .from("quotes")
      .update({
        subtotal,
        total,
        status: "draft",
        notes: parsed.notes ?? quote.notes,
      })
      .eq("id", quote.id);
    if (upd.error) throw new Error(upd.error.message);

    return { id: quote.id, subtotal, total, summary: parsed.summary ?? null, items: items.length };
  });
