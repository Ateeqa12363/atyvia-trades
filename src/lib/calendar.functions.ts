import { createServerFn } from "@tanstack/react-start";
import { extractCalAddressPhoneNotes } from "@/lib/cal-extract";

// Cal.com v2 API — https://cal.com/docs/api-reference/v2/bookings/get-all-bookings
export const listCalBookings = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env.CAL_COM_API_KEY;
  if (!apiKey) {
    return { bookings: [] as CalBooking[], configured: false as const };
  }

  const res = await fetch("https://api.cal.com/v2/bookings?take=100&sortStart=desc", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "cal-api-version": "2024-08-13",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cal.com API failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { data?: any[] };
  const bookings: CalBooking[] = (json.data ?? []).map((b) => {
    const { address, phone, notes } = extractCalAddressPhoneNotes(b);
    return {
      id: String(b.id),
      title: b.title ?? b.eventType?.title ?? "Booking",
      status: b.status ?? "accepted",
      start: b.start,
      end: b.end,
      attendeeName: b.attendees?.[0]?.name ?? null,
      attendeeEmail: b.attendees?.[0]?.email ?? null,
      attendeePhone: phone,
      address,
      notes,
      location: typeof b.location === "string" ? b.location : b.location?.type ?? null,
      meetingUrl: b.meetingUrl ?? null,
      eventTypeId: b.eventTypeId ?? b.eventType?.id ?? null,
      metadata: b.metadata ?? null,
    };
  });

  // Cal.com stores whatever name the voice agent typed in, which can be mis-heard
  // ("Guilia" for "Julia"). Prefer the transcript-verified name from the matching call.
  try {
    const { phoneKey } = await import("@/lib/caller-name.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("from_number, caller_name, caller_name_verified, start_time")
      .eq("caller_name_verified", true)
      .not("caller_name", "is", null)
      .order("start_time", { ascending: false, nullsFirst: false })
      .limit(500);
    const verifiedNames: string[] = [];
    const byPhone = new Map<string, string>();
    for (const c of calls ?? []) {
      if (!c.caller_name) continue;
      verifiedNames.push(c.caller_name);
      const key = phoneKey(c.from_number);
      if (key && !byPhone.has(key)) byPhone.set(key, c.caller_name);
    }
    for (const b of bookings) {
      const key = phoneKey(b.attendeePhone);
      const byNumber = key ? byPhone.get(key) : null;
      if (byNumber) {
        b.attendeeName = byNumber;
        continue;
      }
      // Many calls have no caller number stored, so fall back to matching the
      // (possibly mis-spelled) booking name against verified transcript names.
      const fuzzy = bestNameMatch(b.attendeeName, verifiedNames);
      if (fuzzy) b.attendeeName = fuzzy;
    }
  } catch {
    /* name correction is best-effort */
  }

  return { bookings, configured: true as const };
});

const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

const ratio = (a: string, b: string) =>
  !a.length && !b.length ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length);

/** Share of letters in common, ignoring order — copes with mis-heard vowels ("Guilia"/"Julia"). */
function letterOverlap(a: string, b: string): number {
  const counts = new Map<string, number>();
  for (const ch of a) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let shared = 0;
  for (const ch of b) {
    const n = counts.get(ch) ?? 0;
    if (n > 0) {
      counts.set(ch, n - 1);
      shared += 1;
    }
  }
  return shared / Math.max(a.length, b.length, 1);
}

/**
 * Pick the transcript-verified name that most likely refers to the same person
 * as the (possibly mis-heard) booking name. A shared surname plus a roughly
 * similar first name counts as a match, as does a close whole-name match.
 */
function bestNameMatch(candidate: string | null, verified: string[]): string | null {
  const c = candidate ? normalizeName(candidate) : "";
  if (!c || !verified.length) return null;
  const cParts = c.split(" ");
  let best: { name: string; score: number } | null = null;
  for (const v of verified) {
    const vn = normalizeName(v);
    if (!vn || vn === c) continue;
    const vParts = vn.split(" ");
    let score = ratio(c, vn);
    const sameSurname =
      cParts.length > 1 && vParts.length > 1 && cParts.at(-1) === vParts.at(-1);
    if (sameSurname) {
      const first = ratio(cParts[0], vParts[0]);
      const letters = letterOverlap(cParts[0], vParts[0]);
      if (first >= 0.4 || letters >= 0.6) score = Math.max(score, 0.8 + Math.max(first, letters) * 0.2);
    }
    if (score >= 0.8 && (!best || score > best.score)) best = { name: v, score };
  }
  return best?.name ?? null;
}




export type CalBooking = {
  id: string;
  title: string;
  status: string;
  start: string;
  end: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  address: string | null;
  notes: string | null;
  location: string | null;
  meetingUrl: string | null;
  eventTypeId: number | null;
  metadata: Record<string, string> | null;
};
