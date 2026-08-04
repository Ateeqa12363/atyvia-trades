import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nameKey, sameName, phoneKeyOf } from "@/lib/contact-match";
import { townForOutwardCode } from "@/lib/uk-postcode-towns";

export type CustomerJob = {
  id: string;
  date: string | null;
  status: string;
  price: number;
  notes: string | null;
  /** What the work was — taken from the accepted quote's line items. */
  description: string | null;

  address: string | null;
  invoiced: number;
  paid: number;
};

export type Customer = {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  town: string | null;
  jobs: CustomerJob[];
  jobCount: number;
  completedCount: number;
  revenue: number;
  paidRevenue: number;
  firstJob: string | null;
  lastJob: string | null;
  quoteCount: number;
  callCount: number;
  repeat: boolean;
};

/** Outward code (first half) of a UK postcode found anywhere in an address. */
function outwardCode(address: string | null): string | null {
  if (!address) return null;
  const m = address
    .toUpperCase()
    .match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b/);
  return m?.[1] ?? null;
}

/**
 * Customer book, derived automatically from the jobs a tradesperson has done
 * (plus quotes, invoices and calls for context). No manual data entry: every
 * job groups onto a customer by phone number, falling back to a fuzzy name
 * match so "J Foxtrot" and "Julia Foxtrot" land on the same record.
 */
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { customers: [] as Customer[] };
    const { supabase } = context;
    const siteId = data.siteId;

    const [jobsRes, invoicesRes, quotesRes, callsRes] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, customer_name, phone, address, price, status, notes, scheduled_date, quote_id")
        .eq("site_id", siteId)
        .order("scheduled_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("invoices")
        .select("id, job_id, customer_name, customer_email, phone, address, total, status")
        .eq("site_id", siteId),
      supabase
        .from("quotes")
        .select("id, customer_name, customer_email, phone, address, total, status, notes")
        .eq("site_id", siteId),
      supabase
        .from("calls")
        .select("id, caller_name, from_number")
        .eq("site_id", siteId),
    ]);

    const jobs = jobsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const quotes = quotesRes.data ?? [];
    const calls = callsRes.data ?? [];

    // Work description mirrors the quote's "Notes / terms" so the customer book
    // always reads the same as what was quoted. If a quote has no notes we fall
    // back to its line items, then to the job's own notes.
    const quoteIds = Array.from(
      new Set(jobs.map((j) => j.quote_id as string | null).filter(Boolean) as string[]),
    );
    const notesByQuote = new Map<string, string>();
    for (const q of quotes) {
      const n = String(q.notes ?? "").trim();
      if (n) notesByQuote.set(q.id as string, n);
    }
    const descByQuote = new Map<string, string>();
    const missingNotes = quoteIds.filter((id) => !notesByQuote.has(id));
    if (missingNotes.length) {
      const { data: items } = await supabase
        .from("quote_line_items")
        .select("quote_id, description, position")
        .in("quote_id", missingNotes)
        .order("position", { ascending: true });
      for (const it of items ?? []) {
        const qid = it.quote_id as string;
        const line = String(it.description ?? "").trim();
        if (!line) continue;
        descByQuote.set(qid, descByQuote.has(qid) ? `${descByQuote.get(qid)}\n• ${line}` : `• ${line}`);
      }
    }
    for (const [qid, n] of notesByQuote) descByQuote.set(qid, n);


    const invoiceByJob = new Map<string, { total: number; status: string }>();
    for (const inv of invoices) {
      if (inv.job_id) {
        invoiceByJob.set(inv.job_id as string, {
          total: Number(inv.total ?? 0),
          status: String(inv.status ?? "draft"),
        });
      }
    }

    const list: Customer[] = [];

    const find = (name: string | null, phone: string | null) => {
      const pk = phoneKeyOf(phone);
      if (pk) {
        const byPhone = list.find((c) => phoneKeyOf(c.phone) === pk);
        if (byPhone) return byPhone;
      }
      if (name && nameKey(name)) {
        return list.find((c) => sameName(c.name, name)) ?? null;
      }
      return null;
    };

    // Jobs are the backbone — a customer exists because work was done for them.
    for (const j of jobs) {
      const name = (j.customer_name as string | null) ?? null;
      const phone = (j.phone as string | null) ?? null;
      if (!name && !phone) continue;
      let c = find(name, phone);
      if (!c) {
        c = {
          key: j.id as string,
          name: name ?? phone ?? "Unknown",
          phone,
          email: null,
          address: (j.address as string | null) ?? null,
          town: null,
          jobs: [],
          jobCount: 0,
          completedCount: 0,
          revenue: 0,
          paidRevenue: 0,
          firstJob: null,
          lastJob: null,
          quoteCount: 0,
          callCount: 0,
          repeat: false,
        };
        list.push(c);
      }
      if (!c.phone && phone) c.phone = phone;
      if (name && name.length > c.name.length) c.name = name;
      if (j.address) c.address = j.address as string;

      const inv = invoiceByJob.get(j.id as string);
      const status = String(j.status ?? "booked");
      const price = Number(j.price ?? 0);
      const invoiced = inv ? inv.total : 0;
      const paid = inv && inv.status === "paid" ? inv.total : 0;

      c.jobs.push({
        id: j.id as string,
        date: (j.scheduled_date as string | null) ?? null,
        status,
        price,
        notes: (j.notes as string | null) ?? null,
        description: j.quote_id ? descByQuote.get(j.quote_id as string) ?? null : null,
        address: (j.address as string | null) ?? null,
        invoiced,
        paid,
      });
      if (status !== "cancelled") {
        c.jobCount += 1;
        c.revenue += invoiced || price;
      }
      if (status === "completed" || status === "invoiced") c.completedCount += 1;
      c.paidRevenue += paid;
    }

    // Enrich with emails / quote counts / call counts.
    for (const q of quotes) {
      const c = find((q.customer_name as string | null) ?? null, (q.phone as string | null) ?? null);
      if (!c) continue;
      c.quoteCount += 1;
      if (!c.email && q.customer_email) c.email = q.customer_email as string;
      if (!c.phone && q.phone) c.phone = q.phone as string;
    }
    for (const inv of invoices) {
      const c = find((inv.customer_name as string | null) ?? null, (inv.phone as string | null) ?? null);
      if (!c) continue;
      if (!c.email && inv.customer_email) c.email = inv.customer_email as string;
    }
    for (const call of calls) {
      const c = find((call.caller_name as string | null) ?? null, (call.from_number as string | null) ?? null);
      if (c) c.callCount += 1;
    }

    for (const c of list) {
      c.jobs.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      const dates = c.jobs.map((j) => j.date).filter(Boolean) as string[];
      c.firstJob = dates.length ? dates[dates.length - 1] : null;
      c.lastJob = dates.length ? dates[0] : null;
      c.repeat = c.jobCount > 1;
      c.town = townForOutwardCode(outwardCode(c.address));
    }

    list.sort((a, b) => b.revenue - a.revenue || b.jobCount - a.jobCount);
    return { customers: list };
  });
