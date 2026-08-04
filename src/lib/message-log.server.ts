// Server-only: single audit trail for every outbound message (WhatsApp, SMS,
// email) so the tradesperson can see what the system sent, when, and whether it
// landed. Writes use the service role because the table is read-only to users.

export type MessageLogEntry = {
  siteId: string | null | undefined;
  channel: "whatsapp" | "sms" | "email";
  recipient?: string | null;
  subject?: string | null;
  body?: string | null;
  template?: string | null;
  status: "sent" | "failed" | "skipped" | "queued";
  provider?: string | null;
  providerRef?: string | null;
  error?: string | null;
  quoteId?: string | null;
  jobId?: string | null;
  invoiceId?: string | null;
  siteVisitId?: string | null;
};

/** Best-effort insert — logging must never break a send. */
export async function logMessage(entry: MessageLogEntry): Promise<void> {
  try {
    if (!entry.siteId) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("message_log").insert({
      site_id: entry.siteId,
      channel: entry.channel,
      direction: "outbound",
      recipient: entry.recipient ?? null,
      subject: entry.subject ?? null,
      body: entry.body ?? null,
      template: entry.template ?? null,
      status: entry.status,
      provider: entry.provider ?? null,
      provider_ref: entry.providerRef ?? null,
      error: entry.error ?? null,
      quote_id: entry.quoteId ?? null,
      job_id: entry.jobId ?? null,
      invoice_id: entry.invoiceId ?? null,
      site_visit_id: entry.siteVisitId ?? null,
      sent_at: entry.status === "sent" ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error("[message-log] insert failed", err);
  }
}

/** Raises an in-app notification for the site owner. */
export async function notifyOwner(
  siteId: string | null | undefined,
  notification: { title: string; body?: string | null; kind?: string; link?: string | null },
): Promise<void> {
  try {
    if (!siteId) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site } = await supabaseAdmin
      .from("sites")
      .select("user_id")
      .eq("id", siteId)
      .maybeSingle();
    if (!site?.user_id) return;
    await supabaseAdmin.from("notifications").insert({
      user_id: site.user_id,
      site_id: siteId,
      kind: notification.kind ?? "info",
      title: notification.title,
      body: notification.body ?? null,
      link: notification.link ?? null,
    });
  } catch (err) {
    console.error("[notifications] insert failed", err);
  }
}
