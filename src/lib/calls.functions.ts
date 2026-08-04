import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setCallCallbackCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; completed: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calls")
      .update({
        callback_completed: data.completed,
        callback_completed_at: data.completed ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const listCalls = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, retell_call_id, caller_name, from_number, to_number, direction, status, start_time, duration_seconds, summary, sentiment, recording_url, booked_appointment, appointment_time, custom_data, callback_completed, callback_completed_at",
    )
    .order("start_time", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { calls: data ?? [] };
});

export const getCall = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: call, error } = await supabase
      .from("calls")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { call };
  });

// Manual pull from Retell REST API — useful for backfill or when webhooks aren't wired up yet.
export const syncCallsFromRetell = createServerFn({ method: "POST" }).handler(async () => {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error("RETELL_API_KEY not configured");

  const res = await fetch("https://api.retellai.com/v2/list-calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 100, sort_order: "descending" }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Retell API failed [${res.status}]: ${body}`);
  }
  const calls = (await res.json()) as any[];

  const { extractCallerName } = await import("@/lib/caller-name");
  const { extractCallerPhone } = await import("@/lib/phone-extract");

  const rows = calls.map((c) => {
    const analysis = c.call_analysis ?? {};
    const custom = analysis.custom_analysis_data ?? {};
    return {
      retell_call_id: c.call_id,
      agent_id: c.agent_id ?? null,
      // The number the caller gives on the call is the number we can actually
      // ring back — prefer it over a withheld/anonymous caller ID.
      from_number:
        custom.customer_phone ??
        custom.phone ??
        extractCallerPhone(c.transcript) ??
        c.from_number ??
        null,
      to_number: c.to_number ?? null,
      caller_name:
        custom.caller_name ??
        c.caller_name ??
        extractCallerName(c.transcript) ??
        null,

      direction: c.direction ?? null,
      status: c.call_status ?? null,
      disconnect_reason: c.disconnection_reason ?? null,
      start_time: c.start_timestamp ? new Date(c.start_timestamp).toISOString() : null,
      end_time: c.end_timestamp ? new Date(c.end_timestamp).toISOString() : null,
      duration_seconds:
        c.start_timestamp && c.end_timestamp
          ? Math.round((c.end_timestamp - c.start_timestamp) / 1000)
          : null,
      transcript: c.transcript ?? null,
      summary: analysis.call_summary ?? null,
      sentiment: analysis.user_sentiment ?? null,
      recording_url: c.recording_url ?? null,
      booked_appointment: Boolean(custom.booked_appointment ?? false),
      appointment_time: custom.appointment_time ? new Date(custom.appointment_time).toISOString() : null,
      appointment_notes: custom.appointment_notes ?? null,
      custom_data: custom,
      raw: c,
    };
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Resolve site_id for each row by matching retell_agent_id or phone number against configured sites.
  const { data: sites } = await supabaseAdmin
    .from("sites")
    .select("id, retell_agent_id, phone_number");
  const siteList = sites ?? [];
  // Preserve any site_id we've already stamped so re-syncs don't blow away backfilled links.
  const retellIds = rows.map((r) => r.retell_call_id);
  const { data: existing } = await supabaseAdmin
    .from("calls")
    .select("retell_call_id, site_id, caller_name, caller_name_verified")
    .in("retell_call_id", retellIds);
  const existingSiteById = new Map((existing ?? []).map((e) => [e.retell_call_id, e.site_id]));
  // Never let Retell's (sometimes mis-heard) name overwrite a transcript-verified one.
  const verifiedNameById = new Map(
    (existing ?? [])
      .filter((e) => e.caller_name_verified && e.caller_name)
      .map((e) => [e.retell_call_id, e.caller_name as string]),
  );


  // If a new Retell call arrives before sites have been explicitly configured,
  // infer the site from prior linked calls using the same Retell agent / number.
  const agentIds = Array.from(new Set(rows.map((r) => r.agent_id).filter((v): v is string => Boolean(v))));
  const phoneNumbers = Array.from(new Set(rows.map((r) => r.to_number).filter((v): v is string => Boolean(v))));
  const [agentMatches, phoneMatches] = await Promise.all([
    agentIds.length
      ? supabaseAdmin
          .from("calls")
          .select("agent_id, site_id")
          .in("agent_id", agentIds)
          .not("site_id", "is", null)
      : Promise.resolve({ data: [] }),
    phoneNumbers.length
      ? supabaseAdmin
          .from("calls")
          .select("to_number, site_id")
          .in("to_number", phoneNumbers)
          .not("site_id", "is", null)
      : Promise.resolve({ data: [] }),
  ]);
  const inferredSiteByAgent = new Map<string, string>();
  (agentMatches.data ?? []).forEach((m) => {
    if (m.agent_id && m.site_id && !inferredSiteByAgent.has(m.agent_id)) inferredSiteByAgent.set(m.agent_id, m.site_id);
  });
  const inferredSiteByPhone = new Map<string, string>();
  (phoneMatches.data ?? []).forEach((m) => {
    if (m.to_number && m.site_id && !inferredSiteByPhone.has(m.to_number)) inferredSiteByPhone.set(m.to_number, m.site_id);
  });

  const rowsWithSite = rows.map((r) => {
    let site_id: string | null = existingSiteById.get(r.retell_call_id) ?? null;
    if (!site_id && r.agent_id) {
      site_id = siteList.find((s) => s.retell_agent_id === r.agent_id)?.id ?? null;
    }
    if (!site_id && r.to_number) {
      site_id = siteList.find((s) => s.phone_number === r.to_number)?.id ?? null;
    }
    if (!site_id && r.agent_id) {
      site_id = inferredSiteByAgent.get(r.agent_id) ?? null;
    }
    if (!site_id && r.to_number) {
      site_id = inferredSiteByPhone.get(r.to_number) ?? null;
    }
    return {
      ...r,
      site_id,
      caller_name: verifiedNameById.get(r.retell_call_id) ?? r.caller_name,
    };
  });



  const { error } = await supabaseAdmin.from("calls").upsert(rowsWithSite, { onConflict: "retell_call_id" });
  if (error) throw new Error(error.message);

  // Caller names: use the transcript as the source of truth. The AI pass handles
  // spelled-out names ("J-U-L-I-A") and corrections the regex can't parse, and
  // also fixes names the agent mis-heard. Each call is verified once.
  const { aiExtractCallerName } = await import("@/lib/caller-name.server");
  const { data: unverified } = await supabaseAdmin
    .from("calls")
    .select("id, caller_name, summary, transcript")
    .eq("caller_name_verified", false)
    .not("transcript", "is", null)
    .order("start_time", { ascending: false, nullsFirst: false })
    .limit(12);

  let backfilled = 0;
  for (const row of unverified ?? []) {
    const r = row as { id: string; caller_name: string | null; summary: string | null; transcript: unknown };
    const aiName = await aiExtractCallerName(r.transcript, {
      summary: r.summary,
      agentGuess: r.caller_name,
    });
    const name = aiName ?? extractCallerName(r.transcript) ?? r.caller_name ?? null;
    await supabaseAdmin
      .from("calls")
      .update({ caller_name: name, caller_name_verified: true })
      .eq("id", r.id);
    if (name && name !== r.caller_name) backfilled += 1;
  }

  return { synced: rowsWithSite.length, backfilled };
});


