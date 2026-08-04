import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyRetellSignature(rawBody: string, signature: string, apiKey: string) {
  const match = signature.match(/^v=(\d+),d=([a-f0-9]+)$/i);
  if (!match) {
    const legacyDigest = createHmac("sha256", apiKey).update(rawBody).digest("hex");
    return safeCompare(signature, legacyDigest);
  }

  const [, timestamp, digest] = match;
  if (Math.abs(Date.now() - Number(timestamp)) > SIGNATURE_TOLERANCE_MS) return false;

  const expected = createHmac("sha256", apiKey).update(`${rawBody}${timestamp}`).digest("hex");
  return safeCompare(digest, expected);
}

function verifyWithAnyRetellSecret(rawBody: string, signature: string) {
  const possibleSecrets = [process.env.RETELL_WEBHOOK_SECRET, process.env.RETELL_API_KEY]
    .filter((secret): secret is string => Boolean(secret));

  return possibleSecrets.some((secret) => verifyRetellSignature(rawBody, signature, secret));
}

// Retell fires call_started, call_ended, call_analyzed to this URL.
// Configure it in Retell dashboard → Webhook URL.
export const Route = createFileRoute("/api/public/retell-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();

        // Retell signs with X-Retell-Signature: v={timestamp},d={hmac(rawBody + timestamp)}.
        // Some Retell accounts don't expose a separate webhook secret, so accept either
        // RETELL_WEBHOOK_SECRET when configured or the existing RETELL_API_KEY fallback.
        if (process.env.RETELL_WEBHOOK_SECRET || process.env.RETELL_API_KEY) {
          const sig = request.headers.get("x-retell-signature") ?? "";
          if (!verifyWithAnyRetellSecret(raw, sig)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: any;
        try { payload = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

        const event = payload?.event as string | undefined;
        const call = payload?.call ?? payload?.data ?? payload;
        // Retell's "Test webhook" button sends a synthetic ping with no call_id.
        // Acknowledge with 200 so the dashboard shows success.
        if (!call?.call_id) {
          console.log("[retell-webhook] test ping received", { event });
          return new Response(JSON.stringify({ ok: true, test: true }), {
            headers: { "content-type": "application/json" },
          });
        }

        const analysis = call.call_analysis ?? {};
        const custom = analysis.custom_analysis_data ?? {};

        const row = {
          retell_call_id: call.call_id as string,
          agent_id: call.agent_id ?? null,
          from_number:
            custom.customer_phone ??
            custom.phone ??
            (await import("@/lib/phone-extract")).extractCallerPhone(call.transcript) ??
            call.from_number ??
            null,

          to_number: call.to_number ?? null,
          caller_name:
            custom.caller_name ??
            call.caller_name ??
            (await import("@/lib/caller-name")).extractCallerName(call.transcript) ??
            null,
          direction: call.direction ?? null,
          status: call.call_status ?? event ?? null,
          disconnect_reason: call.disconnection_reason ?? null,
          start_time: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null,
          end_time: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : null,
          duration_seconds:
            call.start_timestamp && call.end_timestamp
              ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
              : null,
          transcript: call.transcript ?? null,
          summary: analysis.call_summary ?? null,
          sentiment: analysis.user_sentiment ?? null,
          recording_url: call.recording_url ?? null,
          booked_appointment: Boolean(custom.booked_appointment ?? analysis.booked_appointment ?? false),
          appointment_time: custom.appointment_time ? new Date(custom.appointment_time).toISOString() : null,
          appointment_notes: custom.appointment_notes ?? null,
          custom_data: custom,
          raw: payload,
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Resolve site_id: try Retell agent_id first, then the destination phone number.
        let site_id: string | null = null;
        if (row.agent_id) {
          const { data } = await supabaseAdmin
            .from("sites")
            .select("id")
            .eq("retell_agent_id", row.agent_id)
            .limit(1)
            .maybeSingle();
          site_id = data?.id ?? null;
        }
        if (!site_id && row.to_number) {
          const { data } = await supabaseAdmin
            .from("sites")
            .select("id")
            .eq("phone_number", row.to_number)
            .limit(1)
            .maybeSingle();
          site_id = data?.id ?? null;
        }
        if (!site_id && row.agent_id) {
          const { data } = await supabaseAdmin
            .from("calls")
            .select("site_id")
            .eq("agent_id", row.agent_id)
            .not("site_id", "is", null)
            .limit(1)
            .maybeSingle();
          site_id = data?.site_id ?? null;
        }
        if (!site_id && row.to_number) {
          const { data } = await supabaseAdmin
            .from("calls")
            .select("site_id")
            .eq("to_number", row.to_number)
            .not("site_id", "is", null)
            .limit(1)
            .maybeSingle();
          site_id = data?.site_id ?? null;
        }

        const { error } = await supabaseAdmin
          .from("calls")
          .upsert({ ...row, site_id }, { onConflict: "retell_call_id" });

        if (error) {
          console.error("[retell-webhook] upsert failed", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
