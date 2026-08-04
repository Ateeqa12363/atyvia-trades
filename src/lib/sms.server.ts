// Server-only helper: send a WhatsApp confirmation via Twilio (sandbox by default).
// Uses the Twilio connector gateway — no direct Twilio auth needed here.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

// Twilio's shared WhatsApp sandbox From number. Override with TWILIO_WHATSAPP_FROM
// once the workspace has an approved WhatsApp Business number.
const DEFAULT_WHATSAPP_FROM = "whatsapp:+14155238886";

function toE164Whatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  // Strip spaces, dashes, parens; keep leading +.
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  return `whatsapp:${withPlus}`;
}

export type WhatsAppSendResult =
  | { sent: true; sid: string }
  | { sent: false; reason: string };

export async function sendWhatsAppMessage(
  toRaw: string | null | undefined,
  body: string,
): Promise<WhatsAppSendResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) {
    return { sent: false, reason: "twilio_not_configured" };
  }
  const to = toE164Whatsapp(toRaw);
  if (!to) return { sent: false, reason: "invalid_phone" };
  const from = process.env.TWILIO_WHATSAPP_FROM || DEFAULT_WHATSAPP_FROM;

  const params = new URLSearchParams({ To: to, From: from, Body: body });

  try {
    const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[whatsapp] send failed [${res.status}]: ${errBody}`);
      return { sent: false, reason: `provider_${res.status}` };
    }
    const json = (await res.json()) as { sid?: string };
    return { sent: true, sid: json.sid ?? "" };
  } catch (err) {
    console.error("[whatsapp] send threw", err);
    return { sent: false, reason: "network_error" };
  }
}

function formatWhen(scheduledAt: string | null | undefined): string {
  if (!scheduledAt) return "your scheduled time";
  const d = new Date(scheduledAt);
  if (isNaN(d.getTime())) return "your scheduled time";
  // e.g. "Tue 21 Jul at 14:30"
  const date = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} at ${time}`;
}

export function quoteVisitConfirmationText(opts: {
  customerName?: string | null;
  scheduledAt?: string | null;
  address?: string | null;
}) {
  const greeting = opts.customerName ? `Hi ${opts.customerName.split(" ")[0]},` : "Hi,";
  const when = formatWhen(opts.scheduledAt);
  const where = opts.address ? ` at ${opts.address}` : "";
  return `${greeting} your *Quote Visit* is confirmed for ${when}${where}. Reply here if you need to reschedule.`;
}

export function jobVisitConfirmationText(opts: {
  customerName?: string | null;
  scheduledAt?: string | null;
  address?: string | null;
}) {
  const greeting = opts.customerName ? `Hi ${opts.customerName.split(" ")[0]},` : "Hi,";
  const when = formatWhen(opts.scheduledAt);
  const where = opts.address ? ` at ${opts.address}` : "";
  return `${greeting} your *Job Visit* is confirmed for ${when}${where}. Reply here if you need to reschedule.`;
}
