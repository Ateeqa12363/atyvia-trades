// Keeps a customer's name, phone and address consistent everywhere.
//
// A manual amend anywhere (calls log, calendar, quotes, jobs, invoices, site
// visits) should be reflected in all the other records for that same customer.
// We match records two ways: explicit links (quote → job → invoice → visit) and
// identity (same phone number, or a close name match) within the same site.

import { sameName, phoneKeyOf, nameKey } from "@/lib/contact-match";
import { upsertCustomer } from "@/lib/customers-store.server";

type Sb = {
  from: (table: string) => any;
};

export type ContactPatch = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
};

type Row = {
  id: string;
  customer_name?: string | null;
  caller_name?: string | null;
  phone?: string | null;
  from_number?: string | null;
  address?: string | null;
  customer_email?: string | null;
};

const nameOf = (r: Row) => r.customer_name ?? r.caller_name ?? null;
const phoneOf = (r: Row) => r.phone ?? r.from_number ?? null;

function matches(row: Row, patch: ContactPatch, previous: ContactPatch) {
  const pk = phoneKeyOf(previous.phone ?? patch.phone ?? null);
  if (pk && phoneKeyOf(phoneOf(row)) === pk) return true;
  const candidateName = previous.name ?? patch.name ?? null;
  if (candidateName && nameKey(candidateName) && sameName(nameOf(row), candidateName)) return true;
  return false;
}

/**
 * Propagates a contact amend across every record for the same customer.
 * Best-effort: never throws, so it can't block the primary save.
 */
export async function propagateContact(
  supabase: Sb,
  opts: {
    siteId: string | null | undefined;
    patch: ContactPatch;
    /** Values as they were before the amend — used to find the other records. */
    previous?: ContactPatch;
    /** Row that was just saved; skipped when writing back. */
    skip?: { table: string; id: string };
  },
): Promise<void> {
  const { siteId, patch } = opts;
  const previous = opts.previous ?? {};
  if (!siteId) return;
  if (!patch.name && !patch.phone && !patch.address && !patch.email) return;

  // Keep the persistent customer record in step with the amend.
  await upsertCustomer(supabase, siteId, patch);


  const targets: Array<{
    table: string;
    select: string;
    map: (p: ContactPatch) => Record<string, string | null>;
  }> = [
    {
      table: "quotes",
      select: "id, customer_name, phone, address, customer_email",
      map: (p) => ({
        ...(p.name ? { customer_name: p.name } : {}),
        ...(p.phone ? { phone: p.phone } : {}),
        ...(p.address ? { address: p.address } : {}),
        ...(p.email ? { customer_email: p.email } : {}),
      }),
    },
    {
      table: "jobs",
      select: "id, customer_name, phone, address",
      map: (p) => ({
        ...(p.name ? { customer_name: p.name } : {}),
        ...(p.phone ? { phone: p.phone } : {}),
        ...(p.address ? { address: p.address } : {}),
      }),
    },
    {
      table: "invoices",
      select: "id, customer_name, phone, address, customer_email",
      map: (p) => ({
        ...(p.name ? { customer_name: p.name } : {}),
        ...(p.phone ? { phone: p.phone } : {}),
        ...(p.address ? { address: p.address } : {}),
        ...(p.email ? { customer_email: p.email } : {}),
      }),
    },
    {
      table: "site_visits",
      select: "id, customer_name, phone, address, customer_email",
      map: (p) => ({
        ...(p.name ? { customer_name: p.name } : {}),
        ...(p.phone ? { phone: p.phone } : {}),
        ...(p.address ? { address: p.address } : {}),
        ...(p.email ? { customer_email: p.email } : {}),
      }),
    },
    {
      table: "calls",
      select: "id, caller_name, from_number",
      map: (p) => ({
        ...(p.name ? { caller_name: p.name } : {}),
        ...(p.phone ? { from_number: p.phone } : {}),
      }),
    },
  ];

  for (const target of targets) {
    try {
      const { data } = await supabase.from(target.table).select(target.select).eq("site_id", siteId);
      const rows = (data ?? []) as Row[];
      const patchValues = target.map(patch);
      if (!Object.keys(patchValues).length) continue;
      for (const row of rows) {
        if (opts.skip && opts.skip.table === target.table && opts.skip.id === row.id) continue;
        if (!matches(row, patch, previous)) continue;
        const changed = Object.entries(patchValues).filter(
          ([key, value]) => (row as Record<string, unknown>)[key] !== value,
        );
        if (!changed.length) continue;
        await supabase.from(target.table).update(Object.fromEntries(changed)).eq("id", row.id);
      }
    } catch {
      /* best-effort sync */
    }
  }
}
