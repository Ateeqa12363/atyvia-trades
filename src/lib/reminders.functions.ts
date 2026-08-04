import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Reminder = {
  id: string;
  kind: string;
  channel: string;
  due_at: string;
  status: string;
  recipient: string | null;
  message: string | null;
  sent_at: string | null;
  error: string | null;
  quote_id: string | null;
  job_id: string | null;
  invoice_id: string | null;
  site_visit_id: string | null;
};

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null; includeDone?: boolean }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { reminders: [] as Reminder[] };
    let query = context.supabase
      .from("reminders")
      .select(
        "id, kind, channel, due_at, status, recipient, message, sent_at, error, quote_id, job_id, invoice_id, site_visit_id",
      )
      .eq("site_id", data.siteId)
      .order("due_at", { ascending: true });
    if (!data.includeDone) query = query.eq("status", "pending");
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { reminders: (rows ?? []) as Reminder[] };
  });

export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      siteId: string;
      kind: string;
      channel?: "whatsapp" | "sms" | "email";
      dueAt: string;
      recipient?: string | null;
      message?: string | null;
      quoteId?: string | null;
      jobId?: string | null;
      invoiceId?: string | null;
      siteVisitId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reminders")
      .insert({
        site_id: data.siteId,
        kind: data.kind,
        channel: data.channel ?? "whatsapp",
        due_at: data.dueAt,
        recipient: data.recipient ?? null,
        message: data.message ?? null,
        quote_id: data.quoteId ?? null,
        job_id: data.jobId ?? null,
        invoice_id: data.invoiceId ?? null,
        site_visit_id: data.siteVisitId ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row?.id ?? null };
  });

export const cancelReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reminders")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
