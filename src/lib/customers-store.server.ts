// Server-only: keeps the persistent `customers` table in step with the
// contact details that flow through calls, quotes, jobs, invoices and visits.
//
// Customers are never entered by hand — every save funnels through here, which
// upserts on the phone key (last 9 digits) and falls back to a name match.

import { phoneKeyOf, sameName } from "@/lib/contact-match";
import { townForOutwardCode } from "@/lib/uk-postcode-towns";

type Sb = { from: (table: string) => any };

export type CustomerUpsert = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

function outwardCode(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = address.toUpperCase().match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b/);
  return m?.[1] ?? null;
}

/**
 * Creates or updates the customer record for a contact and returns its id.
 * Best-effort: never throws so it can't block the primary save.
 */
export async function upsertCustomer(
  supabase: Sb,
  siteId: string | null | undefined,
  contact: CustomerUpsert,
): Promise<string | null> {
  try {
    if (!siteId) return null;
    const name = contact.name?.trim() || null;
    const phone = contact.phone?.trim() || null;
    if (!name && !phone) return null;
    const phone_key = phoneKeyOf(phone);

    let existing: { id: string; name: string | null; phone: string | null } | null = null;

    if (phone_key) {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("site_id", siteId)
        .eq("phone_key", phone_key)
        .maybeSingle();
      existing = data ?? null;
    }
    if (!existing && name) {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("site_id", siteId)
        .limit(500);
      existing = (data ?? []).find((c: { name: string | null }) => sameName(c.name, name)) ?? null;
    }

    const town = townForOutwardCode(outwardCode(contact.address));
    const values: Record<string, unknown> = {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(phone_key ? { phone_key } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.address ? { address: contact.address } : {}),
      ...(town ? { town } : {}),
    };

    if (existing) {
      // Keep the longest known name ("Julia Foxtrot" beats "J Foxtrot").
      if (name && (existing.name?.length ?? 0) >= name.length) delete values["name"];
      if (Object.keys(values).length) {
        await supabase.from("customers").update(values).eq("id", existing.id);
      }
      return existing.id;
    }

    const { data: inserted } = await supabase
      .from("customers")
      .insert({ site_id: siteId, name: name ?? phone ?? "Unknown", ...values })
      .select("id")
      .maybeSingle();
    return (inserted?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}
