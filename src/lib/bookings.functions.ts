import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractCalAddressPhoneNotes, isRealAddress } from "@/lib/cal-extract";
import {
  sendWhatsAppMessage,
  quoteVisitConfirmationText,
  jobVisitConfirmationText,
} from "@/lib/sms.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupaLike = any;

async function sendQuoteVisitTexts(
  supabase: SupaLike,
  rows: Array<{
    id: string;
    customer_name: string | null;
    phone: string | null;
    address: string | null;
    scheduled_at: string | null;
  }>,
) {
  for (const r of rows) {
    if (!r.phone) continue;
    const body = quoteVisitConfirmationText({
      customerName: r.customer_name,
      scheduledAt: r.scheduled_at,
      address: r.address,
    });
    const result = await sendWhatsAppMessage(r.phone, body);
    if (result.sent) {
      await supabase
        .from("site_visits")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", r.id);
    }
  }
}

async function sendJobVisitText(
  supabase: SupaLike,
  row: {
    id: string;
    customer_name: string | null;
    phone: string | null;
    address: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
  },
) {
  if (!row.phone) return;
  const scheduledAt =
    row.scheduled_date && row.scheduled_time
      ? `${row.scheduled_date}T${row.scheduled_time}:00`
      : row.scheduled_date
      ? `${row.scheduled_date}T09:00:00`
      : null;
  const body = jobVisitConfirmationText({
    customerName: row.customer_name,
    scheduledAt,
    address: row.address,
  });
  const result = await sendWhatsAppMessage(row.phone, body);
  if (result.sent) {
    await supabase
      .from("jobs")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

// ============================================================
// Site Visits
// ============================================================

export const listSiteVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { visits: [] };
    const { data: visits, error } = await context.supabase
      .from("site_visits")
      .select("*")
      .eq("site_id", data.siteId)
      .order("scheduled_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { visits: visits ?? [] };
  });

export const updateSiteVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      status?: "scheduled" | "visited" | "quoted" | "cancelled";
      customer_name?: string | null;
      phone?: string | null;
      address?: string | null;
      scheduled_at?: string | null;
      notes?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("site_visits").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSiteVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      site_id: string;
      customer_name?: string | null;
      phone?: string | null;
      address?: string | null;
      scheduled_at?: string | null;
      notes?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("site_visits")
      .insert({ ...data, status: "scheduled" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// Sync from calls (booked_appointment) + Cal.com bookings into site_visits.
export const syncSiteVisits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { synced: 0 };
    let synced = 0;

    // 1) Backfill from calls that have booked_appointment = true and no visit yet.
    const { data: bookedCalls } = await context.supabase
      .from("calls")
      .select("id, caller_name, from_number, appointment_time, appointment_notes")
      .eq("site_id", data.siteId)
      .eq("booked_appointment", true)
      .order("appointment_time", { ascending: false })
      .limit(200);

    const callIds = (bookedCalls ?? []).map((c) => c.id);
    let existingCallIds = new Set<string>();
    if (callIds.length > 0) {
      const { data: exists } = await context.supabase
        .from("site_visits")
        .select("call_id")
        .in("call_id", callIds);
      existingCallIds = new Set((exists ?? []).map((e) => e.call_id).filter(Boolean) as string[]);
    }

    const toInsertFromCalls = (bookedCalls ?? [])
      .filter((c) => !existingCallIds.has(c.id))
      .map((c) => ({
        site_id: data.siteId!,
        call_id: c.id,
        customer_name: c.caller_name,
        phone: c.from_number,
        scheduled_at: c.appointment_time,
        notes: c.appointment_notes,
        status: "scheduled" as const,
      }));

    if (toInsertFromCalls.length > 0) {
      const { data: inserted, error } = await context.supabase
        .from("site_visits")
        .insert(toInsertFromCalls)
        .select("id, customer_name, phone, address, scheduled_at");
      if (!error) {
        synced += toInsertFromCalls.length;
        await sendQuoteVisitTexts(context.supabase, inserted ?? []);
      }
    }

    // 2) Sync Cal.com bookings.
    const apiKey = process.env.CAL_COM_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.cal.com/v2/bookings?take=100&sortStart=desc", {
          headers: { Authorization: `Bearer ${apiKey}`, "cal-api-version": "2024-08-13" },
        });
        if (res.ok) {
          const json = (await res.json()) as { data?: any[] };

          const rows = (json.data ?? []).map((b) => {
            const { address, phone, notes } = extractCalAddressPhoneNotes(b);
            const attendeePhone =
              b.attendees?.[0]?.phoneNumber && String(b.attendees[0].phoneNumber).trim()
                ? b.attendees[0].phoneNumber
                : null;
            return {
              site_id: data.siteId!,
              cal_booking_id: String(b.id),
              customer_name: b.attendees?.[0]?.name ?? b.title ?? null,
              phone: phone ?? attendeePhone,
              customer_email: b.attendees?.[0]?.email ?? null,
              scheduled_at: b.start ?? null,
              address,
              notes: notes ?? b.title ?? null,
              status:
                (b.status === "cancelled" ? "cancelled" : "scheduled") as
                  | "scheduled"
                  | "cancelled",
            };
          });

          if (rows.length > 0) {
            // Preserve manually-edited status/address on upsert. Only keep the
            // previous address when it looks like a real address — never keep
            // a stale Cal.com video URL or placeholder from an earlier sync.
            const { data: existing } = await context.supabase
              .from("site_visits")
              .select("cal_booking_id, status, address, phone, notes")
              .in("cal_booking_id", rows.map((r) => r.cal_booking_id));
            const existingByKey = new Map(
              (existing ?? []).map((e) => [e.cal_booking_id, e]),
            );
            const merged = rows.map((r) => {
              const prev = existingByKey.get(r.cal_booking_id);
              const prevAddrRealistic = isRealAddress(prev?.address);
              return {
                ...r,
                // Cal.com is the source of truth for cancellations: if it says
                // cancelled, override any local status. Otherwise preserve local edits.
                status: r.status === "cancelled" ? "cancelled" : prev?.status ?? r.status,
                address: isRealAddress(r.address)
                  ? r.address
                  : prevAddrRealistic
                  ? prev!.address
                  : r.address ?? null,
                phone: r.phone ?? prev?.phone ?? null,
                notes: r.notes ?? prev?.notes ?? null,
              };
            });
            const { error } = await context.supabase
              .from("site_visits")
              .upsert(merged, { onConflict: "cal_booking_id" });
            if (!error) {
              synced += merged.length;
              // Only text on FIRST-time inserts (no prior row for this cal_booking_id)
              // and only for non-cancelled bookings.
              const newCalIds = merged
                .filter((r) => !existingByKey.has(r.cal_booking_id) && r.status !== "cancelled")
                .map((r) => r.cal_booking_id);
              if (newCalIds.length > 0) {
                const { data: freshRows } = await context.supabase
                  .from("site_visits")
                  .select("id, customer_name, phone, address, scheduled_at")
                  .in("cal_booking_id", newCalIds);
                await sendQuoteVisitTexts(context.supabase, freshRows ?? []);
              }
            }
          }

        }
      } catch {
        /* soft-fail — page still shows call-backed visits */
      }
    }

    return { synced };
  });

// ============================================================
// Quotes
// ============================================================

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { quotes: [] };
    const { data: quotes, error } = await context.supabase
      .from("quotes")
      .select("*")
      .eq("site_id", data.siteId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { quotes: quotes ?? [] };
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const [q, li] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", data.id)
        .order("position", { ascending: true }),
    ]);
    if (q.error) throw new Error(q.error.message);
    if (li.error) throw new Error(li.error.message);
    return { quote: q.data, lineItems: li.data ?? [] };
  });

export const createQuoteFromVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { visitId: string }) => data)
  .handler(async ({ data, context }) => {
    // Idempotent: if a non-terminal quote already exists for this visit, reuse it.
    const { data: existing } = await context.supabase
      .from("quotes")
      .select("id")
      .eq("site_visit_id", data.visitId)
      .in("status", ["draft", "sent", "accepted", "declined"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("site_visits").update({ status: "quoted" }).eq("id", data.visitId);
      return { id: existing.id };
    }
    const { data: v, error: ve } = await context.supabase
      .from("site_visits")
      .select("id, site_id, customer_name, customer_email, address")
      .eq("id", data.visitId)
      .single();
    if (ve) throw new Error(ve.message);
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(24).toString("hex");
    const { data: q, error } = await context.supabase
      .from("quotes")
      .insert({
        site_id: v.site_id,
        site_visit_id: v.id,
        customer_name: v.customer_name,
        customer_email: v.customer_email,
        address: v.address,
        subtotal: 0,
        vat_rate: 20,
        total: 0,
        status: "draft",
        respond_token: token,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("site_visits").update({ status: "quoted" }).eq("id", v.id);
    return { id: q.id };
  });


export const updateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      customer_name?: string | null;
      customer_email?: string | null;
      phone?: string | null;
      address?: string | null;
      vat_rate?: number;
      status?: "draft" | "sent" | "accepted" | "declined" | "expired";
      notes?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const p: {
      customer_name?: string | null;
      customer_email?: string | null;
      phone?: string | null;
      address?: string | null;
      vat_rate?: number;
      status?: "draft" | "sent" | "accepted" | "declined" | "expired";
      notes?: string | null;
      sent_at?: string;
      accepted_at?: string;
      declined_at?: string | null;
      responded_by?: string | null;
    } = { ...patch };
    if (patch.status === "sent") p.sent_at = new Date().toISOString();
    if (patch.status === "accepted") {
      p.accepted_at = new Date().toISOString();
      // Overriding a prior decline — clear it.
      p.declined_at = null;
      p.responded_by = "user";
    }
    if (patch.status === "declined") {
      p.declined_at = new Date().toISOString();
      p.responded_by = "user";
    }
    // Snapshot the contact as it was, so an amend can be traced to the other records.
    const { data: before } = await context.supabase
      .from("quotes")
      .select("site_id, customer_name, customer_email, phone, address")
      .eq("id", id)
      .maybeSingle();
    const { error } = await context.supabase.from("quotes").update(p).eq("id", id);
    if (error) throw new Error(error.message);

    if (before && (patch.customer_name || patch.phone || patch.address || patch.customer_email)) {
      const { propagateContact } = await import("@/lib/contact-sync.server");
      await propagateContact(context.supabase, {
        siteId: before.site_id,
        patch: {
          name: patch.customer_name ?? null,
          phone: patch.phone ?? null,
          address: patch.address ?? null,
          email: patch.customer_email ?? null,
        },
        previous: { name: before.customer_name, phone: before.phone },
        skip: { table: "quotes", id },
      });
    }


    // Auto-create a job on acceptance (idempotent — skip if one already exists).
    if (patch.status === "accepted") {
      const { data: q } = await context.supabase
        .from("quotes")
        .select("id, site_id, site_visit_id, customer_name, address, phone, total")
        .eq("id", id)
        .single();
      if (q) {
        const { data: existing } = await context.supabase
          .from("jobs")
          .select("id")
          .eq("quote_id", q.id)
          .maybeSingle();
        if (!existing) {
          let phone: string | null = q.phone ?? null;

          let scheduledDate: string | null = null;
          let scheduledTime: string | null = null;
          if (q.site_visit_id) {
            const { data: sv } = await context.supabase
              .from("site_visits")
              .select("phone, scheduled_at")
              .eq("id", q.site_visit_id)
              .maybeSingle();
            phone = phone ?? sv?.phone ?? null;

            if (sv?.scheduled_at) {
              const d = new Date(sv.scheduled_at);
              scheduledDate = d.toISOString().slice(0, 10);
              scheduledTime = d.toISOString().slice(11, 16);
            }
          }
          const { data: jobRow } = await context.supabase.from("jobs").insert({
            site_id: q.site_id,
            quote_id: q.id,
            site_visit_id: q.site_visit_id,
            customer_name: q.customer_name,
            address: q.address,
            phone,
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            price: q.total,
            status: "booked",
          }).select("id, customer_name, phone, address, scheduled_date, scheduled_time").single();
          if (jobRow) await sendJobVisitText(context.supabase, jobRow);
        }
      }
    }

    return { ok: true };
  });

export const replaceQuoteLineItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      quoteId: string;
      items: Array<{ description: string; quantity: number; unit_price: number }>;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    // Wipe existing rows and insert new ones — simplest and correct for small lists.
    const del = await context.supabase.from("quote_line_items").delete().eq("quote_id", data.quoteId);
    if (del.error) throw new Error(del.error.message);

    const rows = data.items.map((it, i) => ({
      quote_id: data.quoteId,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: Number((it.quantity * it.unit_price).toFixed(2)),
      position: i,
    }));
    let subtotal = 0;
    for (const r of rows) subtotal += r.line_total;

    if (rows.length > 0) {
      const ins = await context.supabase.from("quote_line_items").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }

    // Recompute totals using the quote's current VAT rate.
    const { data: q } = await context.supabase
      .from("quotes")
      .select("vat_rate")
      .eq("id", data.quoteId)
      .single();
    const vatRate = Number(q?.vat_rate ?? 20);
    const total = Number((subtotal * (1 + vatRate / 100)).toFixed(2));
    const upd = await context.supabase
      .from("quotes")
      .update({ subtotal: Number(subtotal.toFixed(2)), total })
      .eq("id", data.quoteId);
    if (upd.error) throw new Error(upd.error.message);
    return { subtotal, total };
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Jobs
// ============================================================

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { jobs: [] };
    const { data: jobs, error } = await context.supabase
      .from("jobs")
      .select("*")
      .eq("site_id", data.siteId)
      .order("scheduled_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { jobs: jobs ?? [] };
  });

export const createJobFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { quoteId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: q, error: qe } = await context.supabase
      .from("quotes")
      .select("id, site_id, site_visit_id, customer_name, address, total, status")
      .eq("id", data.quoteId)
      .single();
    if (qe) throw new Error(qe.message);
    if (q.status !== "accepted") throw new Error("Quote must be accepted before creating a job");

    // Return existing job if the accept step already auto-created one.
    const { data: existing } = await context.supabase
      .from("jobs")
      .select("id")
      .eq("quote_id", q.id)
      .maybeSingle();
    if (existing) return { id: existing.id };

    let phone: string | null = null;
    let scheduledDate: string | null = null;
    let scheduledTime: string | null = null;
    if (q.site_visit_id) {
      const { data: sv } = await context.supabase
        .from("site_visits")
        .select("phone, scheduled_at")
        .eq("id", q.site_visit_id)
        .maybeSingle();
      phone = sv?.phone ?? null;
      if (sv?.scheduled_at) {
        const d = new Date(sv.scheduled_at);
        scheduledDate = d.toISOString().slice(0, 10);
        scheduledTime = d.toISOString().slice(11, 16);
      }
    }

    const { data: job, error } = await context.supabase
      .from("jobs")
      .insert({
        site_id: q.site_id,
        quote_id: q.id,
        site_visit_id: q.site_visit_id,
        customer_name: q.customer_name,
        address: q.address,
        phone,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        price: q.total,
        status: "booked",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: job.id };
  });

export const updateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      customer_name?: string | null;
      address?: string | null;
      phone?: string | null;
      scheduled_date?: string | null;
      scheduled_time?: string | null;
      assigned_to?: string | null;
      price?: number;
      status?: "booked" | "in_progress" | "completed" | "invoiced" | "cancelled";
      notes?: string | null;
      duration_minutes?: number | null;
      syncToCal?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { id, syncToCal, ...patch } = data;
    const { data: before } = await context.supabase
      .from("jobs")
      .select("site_id, customer_name, phone, address")
      .eq("id", id)
      .maybeSingle();
    const { error } = await context.supabase.from("jobs").update(patch).eq("id", id);
    if (error) throw new Error(error.message);

    if (before && (patch.customer_name || patch.phone || patch.address)) {
      const { propagateContact } = await import("@/lib/contact-sync.server");
      await propagateContact(context.supabase, {
        siteId: before.site_id,
        patch: {
          name: patch.customer_name ?? null,
          phone: patch.phone ?? null,
          address: patch.address ?? null,
        },
        previous: { name: before.customer_name, phone: before.phone },
        skip: { table: "jobs", id },
      });
    }


    const { data: job } = await context.supabase
      .from("jobs")
      .select("id, site_visit_id, customer_name, address, phone, notes, scheduled_date, scheduled_time, duration_minutes, status, cal_booking_id")
      .eq("id", id)
      .maybeSingle();
    if (!job) return { ok: true };

    // Mirror basic fields onto the linked site visit so lists stay consistent.
    let siteVisit: { cal_booking_id: string | null; customer_email: string | null } | null = null;
    if (job.site_visit_id) {
      const { data: sv } = await context.supabase
        .from("site_visits")
        .select("cal_booking_id, customer_email")
        .eq("id", job.site_visit_id)
        .maybeSingle();
      siteVisit = sv ?? null;
      await context.supabase.from("site_visits").update({
        customer_name: job.customer_name,
        address: job.address,
        phone: job.phone,
        notes: job.notes,
        ...(job.status === "cancelled" ? { status: "cancelled" as const } : {}),
      }).eq("id", job.site_visit_id);
    }

    // Push a dedicated Cal.com booking for the job visit (independent from the estimate site-visit booking).
    const apiKey = process.env.CAL_COM_API_KEY;
    if (syncToCal !== false && apiKey) {
      const headers = { Authorization: `Bearer ${apiKey}`, "cal-api-version": "2024-08-13" };
      const jsonHeaders = { ...headers, "Content-Type": "application/json" };
      try {
        // Cancel path — if the job was cancelled, cancel its Cal.com booking and stop.
        if (job.status === "cancelled") {
          if (job.cal_booking_id) {
            await fetch(`https://api.cal.com/v2/bookings/${job.cal_booking_id}/cancel`, {
              method: "POST",
              headers: jsonHeaders,
              body: JSON.stringify({ cancellationReason: "Cancelled from Atyvia jobs board" }),
            }).catch(() => {});
          }
          return { ok: true };
        }

        // Need a scheduled date to create/update a calendar entry.
        if (!job.scheduled_date) return { ok: true };
        const time = job.scheduled_time && /^\d{2}:\d{2}$/.test(job.scheduled_time) ? job.scheduled_time : "09:00";
        const start = new Date(`${job.scheduled_date}T${time}:00`).toISOString();
        const duration = job.duration_minutes && job.duration_minutes > 0 ? job.duration_minutes : 60;

        // Resolve an eventTypeId: prefer a dedicated variable-length job event type
        // configured via CAL_COM_JOB_EVENT_TYPE_ID, otherwise fall back to the site
        // visit's event type (fixed duration — will book its default length).
        let eventTypeId: number | null = null;
        const configuredEtId = process.env.CAL_COM_JOB_EVENT_TYPE_ID;
        if (configuredEtId && /^\d+$/.test(configuredEtId)) {
          eventTypeId = Number(configuredEtId);
        }
        if (!eventTypeId && siteVisit?.cal_booking_id) {
          const r = await fetch(`https://api.cal.com/v2/bookings/${siteVisit.cal_booking_id}`, { headers });
          if (r.ok) {
            const j = (await r.json()) as { data?: { eventTypeId?: number; eventType?: { id?: number } } };
            eventTypeId = j.data?.eventTypeId ?? j.data?.eventType?.id ?? null;
          }
        }
        if (!eventTypeId) {
          throw new Error(
            "Cal.com job event type not configured. Create a variable-length event type in Cal.com and set CAL_COM_JOB_EVENT_TYPE_ID.",
          );
        }

        // Cancel any existing job booking first so we can create a fresh block matching new time/duration.
        if (job.cal_booking_id) {
          await fetch(`https://api.cal.com/v2/bookings/${job.cal_booking_id}/cancel`, {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify({ cancellationReason: "Rescheduled from Atyvia jobs board" }),
          }).catch(() => {});
        }

        const attendeeEmail = siteVisit?.customer_email || `job-${job.id}@atyvia.app`;
        const createBody: Record<string, unknown> = {
          start,
          eventTypeId,
          attendee: {
            name: job.customer_name || "Customer",
            email: attendeeEmail,
            timeZone: "Europe/London",
            language: "en",
            ...(job.phone ? { phoneNumber: job.phone } : {}),
          },
          bookingFieldsResponses: {
            title: `Job visit — ${job.customer_name || "Customer"}`,
            name: job.customer_name || "Customer",
            email: attendeeEmail,
            attendeePhoneNumber: job.phone || "",
            jobAddress: job.address || "TBC",
            notes: job.notes || "",
          },
          metadata: { source: "atyvia-job", job_id: job.id },
        };
        // Only send lengthInMinutes when using the dedicated variable-length event type.
        if (configuredEtId && eventTypeId === Number(configuredEtId)) {
          createBody.lengthInMinutes = duration;
        }
        const createRes = await fetch("https://api.cal.com/v2/bookings", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(createBody),
        });
        if (createRes.ok) {
          const j = (await createRes.json()) as { data?: { uid?: string; id?: number } };
          const newId = j.data?.uid || (j.data?.id != null ? String(j.data.id) : null);
          if (newId) {
            await context.supabase.from("jobs").update({ cal_booking_id: newId }).eq("id", job.id);
          }
        } else {
          const body = await createRes.text();
          console.warn("[cal.com] create job booking failed", createRes.status, body);
          throw new Error(`Cal.com booking failed (${createRes.status}): ${body.slice(0, 300)}`);
        }
      } catch (err) {
        console.warn("[cal.com] job sync error", err);
      }
    }

    return { ok: true };
  });


/** Permanently delete a job (and cancel any Cal.com booking it created). */
export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("jobs")
      .select("id, cal_booking_id")
      .eq("id", data.id)
      .maybeSingle();

    const apiKey = process.env.CAL_COM_API_KEY;
    if (job?.cal_booking_id && apiKey) {
      await fetch(`https://api.cal.com/v2/bookings/${job.cal_booking_id}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "cal-api-version": "2024-08-13",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancellationReason: "Job deleted in Atyvia" }),
      }).catch(() => {});
    }

    // Remove dependent invoices first so the delete isn't blocked by references.
    const { data: invoices } = await context.supabase
      .from("invoices")
      .select("id")
      .eq("job_id", data.id);
    for (const inv of invoices ?? []) {
      await context.supabase.from("invoice_line_items").delete().eq("invoice_id", inv.id);
      await context.supabase.from("invoices").delete().eq("id", inv.id);
    }

    const { error } = await context.supabase.from("jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * "Visit completed" from the Calendar — turns a quote visit booking into a
 * quote that's ready to be priced, carrying all the customer's details over.
 * Idempotent per Cal.com booking.
 */
export const completeVisitFromCalBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      siteId: string;
      calBookingId: string;
      customer_name: string | null;
      customer_email: string | null;
      phone: string | null;
      address: string | null;
      notes: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("quotes")
      .select("id")
      .eq("cal_booking_id", data.calBookingId)
      .maybeSingle();
    if (existing) return { id: existing.id, created: false };

    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(24).toString("hex");

    const { data: settings } = await context.supabase
      .from("quote_settings")
      .select("vat_rate, vat_registered")
      .eq("site_id", data.siteId)
      .maybeSingle();
    const vatRate = settings?.vat_registered === false ? 0 : Number(settings?.vat_rate ?? 20);

    const { data: q, error } = await context.supabase
      .from("quotes")
      .insert({
        site_id: data.siteId,
        cal_booking_id: data.calBookingId,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        phone: data.phone,
        address: data.address,
        notes: data.notes,
        subtotal: 0,
        vat_rate: vatRate,
        total: 0,
        status: "awaiting_quote",
        visit_completed_at: new Date().toISOString(),
        respond_token: token,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: q.id, created: true };
  });

/** Cal.com booking ids that have already been marked "visit completed". */
export const listCompletedVisitBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { bookingIds: [] as string[] };
    const { data: rows, error } = await context.supabase
      .from("quotes")
      .select("cal_booking_id")
      .eq("site_id", data.siteId)
      .not("cal_booking_id", "is", null);
    if (error) throw new Error(error.message);
    return { bookingIds: (rows ?? []).map((r) => r.cal_booking_id as string) };
  });

/**
 * Pull a customer's contact details out of data we already hold — the calls log
 * first (that's where the AI receptionist captured them), then the linked site
 * visit and quote. Used to auto-fill the Jobs form so the tradesperson only has
 * to ring the customer for availability.
 */
export const suggestJobContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null; jobId: string; name?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { sameName, phoneKeyOf } = await import("@/lib/contact-match");
    const empty = { phone: null as string | null, address: null as string | null, email: null as string | null, source: null as string | null };
    if (!data.siteId) return empty;

    const { data: job } = await context.supabase
      .from("jobs")
      .select("id, customer_name, phone, address, site_visit_id, quote_id")
      .eq("id", data.jobId)
      .maybeSingle();
    const name = data.name || job?.customer_name || null;

    let phone: string | null = null;
    let address: string | null = null;
    let email: string | null = null;
    let source: string | null = null;

    // 1. Linked site visit / quote (already carries verified details).
    if (job?.site_visit_id) {
      const { data: sv } = await context.supabase
        .from("site_visits")
        .select("phone, address, customer_email")
        .eq("id", job.site_visit_id)
        .maybeSingle();
      if (sv) {
        phone ||= sv.phone;
        address ||= sv.address;
        email ||= sv.customer_email;
        if (sv.phone) source = "site visit";
      }
    }
    if (job?.quote_id) {
      const { data: q } = await context.supabase
        .from("quotes")
        .select("phone, address, customer_email")
        .eq("id", job.quote_id)
        .maybeSingle();
      if (q) {
        phone ||= q.phone;
        address ||= q.address;
        email ||= q.customer_email;
        if (!source && q.phone) source = "quote";
      }
    }

    // 2. Calls log — match on the caller's name.
    if ((!phone || !address) && name) {
      const { data: calls } = await context.supabase
        .from("calls")
        .select("caller_name, from_number, start_time")
        .eq("site_id", data.siteId)
        .order("start_time", { ascending: false, nullsFirst: false })
        .limit(400);
      const hit = (calls ?? []).find((c) => sameName(c.caller_name, name) && !!c.from_number);
      if (hit?.from_number && !phone) {
        phone = hit.from_number;
        source = "calls log";
      }
    }

    // 3. Any other site visit for the same person (address + phone).
    if ((!phone || !address) && name) {
      const { data: visits } = await context.supabase
        .from("site_visits")
        .select("customer_name, phone, address, customer_email")
        .eq("site_id", data.siteId)
        .order("created_at", { ascending: false })
        .limit(300);
      const hit = (visits ?? []).find((v) => sameName(v.customer_name, name));
      if (hit) {
        if (!phone && hit.phone) {
          phone = hit.phone;
          source ||= "site visit";
        }
        address ||= hit.address;
        email ||= hit.customer_email;
      }
    }

    // Don't suggest what the job already has.
    const jobKey = phoneKeyOf(job?.phone);
    if (jobKey && phoneKeyOf(phone) === jobKey) phone = null;

    return { phone, address, email, source };
  });
