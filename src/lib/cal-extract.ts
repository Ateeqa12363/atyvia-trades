// Shared helpers for pulling a real customer address + phone + tidy notes
// out of a Cal.com booking payload. Cal.com stuffs the address into
// different fields depending on how the event type is configured:
//   - `location` as a video URL, a type slug ("inPerson"), or an object
//   - custom booking-field responses (address / postcode / job)
//   - the free-text description ("Patio quote at 67 Bister Rd, HP19 6AL")
// These helpers try each source in order and fall back to a postcode walk.

export const POSTCODE_RE = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d?[A-Z]{0,2}\b/i;

export const isAddressish = (s: unknown): s is string =>
  typeof s === "string" &&
  !!s.trim() &&
  !/^https?:\/\//i.test(s) &&
  !/^integrations?:/i.test(s) &&
  !/cal\.com\/video/i.test(s) &&
  !/^(in[- ]?person|attendee|phone|link|integrations?)/i.test(s.trim()) &&
  !/on[- ]?site at (?:customer|job|the customer|client|attendee)/i.test(s) &&
  !/^(?:on[- ]?site|in[- ]?person)(?:\s+at\s+.*(?:address|location|premises|site|home))?$/i.test(s.trim()) &&
  !/customer[' ]?s? (?:home|address|premises)/i.test(s) &&
  s.trim().length >= 4;

export const isRealAddress = (s: string | null | undefined) =>
  !!s &&
  isAddressish(s) &&
  (POSTCODE_RE.test(s) || /\d/.test(s)) &&
  // Reject placeholder / AI-generated filler.
  !/on[- ]?site at (?:customer|job|the customer|client|attendee)/i.test(s) &&
  !/customer[' ]?s? (?:home|address|premises)/i.test(s);

export function pickAddress(b: any): string | null {
  // 1) Structured location.
  const loc = b?.location;
  if (typeof loc === "string" && isAddressish(loc) && /[\s,\d]/.test(loc)) return loc;
  if (loc && typeof loc === "object") {
    const addr = loc.address ?? loc.formattedAddress ?? loc.optionValue ?? loc.value ?? null;
    if (isAddressish(addr)) return addr;
  }
  // 2) Attendee-level.
  const att = b?.attendees?.[0];
  if (isAddressish(att?.address)) return att.address;
  if (isAddressish(att?.location)) return att.location;

  // 3) Custom booking-field responses.
  const respCandidates: any[] = [
    b?.bookingFieldsResponses,
    b?.responses,
    b?.userFieldsResponses,
    b?.metadata,
  ].filter((r) => r && typeof r === "object");
  const keyMatches = (k: string) => /address|postcode|postal|location|site|job/i.test(k);
  for (const resp of respCandidates) {
    for (const [k, v] of Object.entries(resp)) {
      if (typeof v === "string" && keyMatches(k) && isAddressish(v)) return v;
      if (v && typeof v === "object") {
        const val = (v as any).value ?? (v as any).answer;
        if (typeof val === "string" && keyMatches(k) && isAddressish(val)) return val;
      }
    }
  }
  const fieldArrays: any[] = [b?.bookingFields, b?.customInputs].filter(Array.isArray);
  for (const arr of fieldArrays) {
    for (const f of arr) {
      const k = String(f?.slug ?? f?.name ?? f?.label ?? "");
      const v = f?.value ?? f?.answer;
      if (typeof v === "string" && keyMatches(k) && isAddressish(v)) return v;
    }
  }

  // 4) Last-ditch: walk every string, return the first UK-postcode hit.
  const seen = new Set<any>();
  const walk = (node: any): string | null => {
    if (!node || seen.has(node)) return null;
    if (typeof node === "string")
      return POSTCODE_RE.test(node) && isAddressish(node) ? node : null;
    if (typeof node !== "object") return null;
    seen.add(node);
    for (const v of Array.isArray(node) ? node : Object.values(node)) {
      const hit = walk(v);
      if (hit) return hit;
    }
    return null;
  };
  return walk(b);
}

// Split a free-text notes/description blob into { address, notes }.
// If a line contains a postcode, that line becomes the address; the rest
// stays as notes. Prose like "... at 67 Bister Rd, HP19 6AL" is trimmed
// down to just the address portion.
export function splitAddressFromNotes(
  text: string | null | undefined,
): { address: string | null; notes: string | null } {
  if (!text || typeof text !== "string") return { address: null, notes: text ?? null };
  const lines = text.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  const addrIdx = lines.findIndex((l) => POSTCODE_RE.test(l));
  if (addrIdx === -1) return { address: null, notes: text.trim() || null };
  let addr = lines[addrIdx];
  const atMatch = addr.match(/\bat\s+(\d+[^.]*)$/i);
  if (atMatch) addr = atMatch[1].trim();
  addr = addr.replace(/[.,;]+$/, "").trim();
  const remaining = lines.filter((_, i) => i !== addrIdx).join("\n").trim();
  return { address: addr, notes: remaining || null };
}

// Combine every source: structured pickAddress first, then notes-derived
// address as a fallback. Returns tidied notes with the address line removed.
export function extractCalAddressPhoneNotes(b: any): {
  address: string | null;
  phone: string | null;
  notes: string | null;
} {
  const rawNotes: string | null =
    b?.description ?? b?.additionalNotes ?? b?.notes ?? b?.responses?.notes ?? null;
  const split = splitAddressFromNotes(rawNotes);
  const structured = pickAddress(b);
  const address = isRealAddress(structured) ? structured : split.address ?? structured ?? null;
  const att = b?.attendees?.[0];
  const phone: string | null =
    att?.phoneNumber ??
    att?.phone ??
    (typeof b?.responses?.phone === "string" ? b.responses.phone : null) ??
    (typeof b?.responses?.attendeePhoneNumber === "string"
      ? b.responses.attendeePhoneNumber
      : null) ??
    null;
  return { address, phone, notes: split.notes ?? null };
}
