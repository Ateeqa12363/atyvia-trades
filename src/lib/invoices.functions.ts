import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeEnvironment } from "@/lib/stripe";
export type InvoiceLine = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type InvoiceStatus = "draft" | "approved" | "sent" | "paid";

/**
 * Lists invoices for a site, first creating a draft invoice for any completed
 * job that doesn't have one yet.
 */
export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { siteId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.siteId) return { invoices: [] };
    const { supabase } = context;

    // --- auto-generate drafts from completed jobs ---
    const { data: completed } = await supabase
      .from("jobs")
      .select(
        "id, customer_name, address, phone, price, notes, scheduled_date, quote_id, site_visit_id",
      )
      .eq("site_id", data.siteId)
      .eq("status", "completed");

    if (completed && completed.length > 0) {
      const { data: existing } = await supabase
        .from("invoices")
        .select("job_id")
        .eq("site_id", data.siteId);
      const have = new Set((existing ?? []).map((e) => e.job_id).filter(Boolean) as string[]);
      const missing = completed.filter((j) => !have.has(j.id));

      if (missing.length > 0) {
        const { data: settings } = await supabase
          .from("quote_settings")
          .select("vat_registered, vat_rate, payment_terms_days, payment_methods, terms")
          .eq("site_id", data.siteId)
          .maybeSingle();
        const vatRate = settings?.vat_registered ? Number(settings.vat_rate ?? 20) : 0;
        const termsDays = Number(settings?.payment_terms_days ?? 14);

        const { count } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("site_id", data.siteId);
        let seq = (count ?? 0) + 1;
        const year = new Date().getFullYear();

        // Calls log is the source of truth for customer phone numbers.
        const { data: calls } = await supabase
          .from("calls")
          .select("caller_name, from_number, start_time")
          .eq("site_id", data.siteId)
          .not("from_number", "is", null)
          .order("start_time", { ascending: false, nullsFirst: false })
          .limit(400);
        const { sameName } = await import("@/lib/contact-match");
        const phoneFromCalls = (name: string | null) =>
          (name ? (calls ?? []).find((c) => sameName(c.caller_name, name))?.from_number : null) ??
          null;

        for (const job of missing) {
          // Mirror the accepted quote: same customer details and same line items.
          let quote: {
            customer_email: string | null;
            phone: string | null;
            address: string | null;
            vat_rate: number | null;
            notes: string | null;
            id: string;
          } | null = null;
          if (job.quote_id) {
            const { data: q } = await supabase
              .from("quotes")
              .select("id, customer_email, phone, address, vat_rate, notes")
              .eq("id", job.quote_id)
              .maybeSingle();
            quote = q ?? null;
          }
          if (!quote) {
            const { data: q } = await supabase
              .from("quotes")
              .select("id, customer_email, phone, address, vat_rate, notes")
              .eq("site_id", data.siteId)
              .eq("customer_name", job.customer_name ?? "")
              .order("created_at", { ascending: false })
              .limit(1);
            quote = q && q.length > 0 ? q[0] : null;
          }

          let lines: { description: string; quantity: number; unit_price: number }[] = [];
          if (quote) {
            const { data: qli } = await supabase
              .from("quote_line_items")
              .select("description, quantity, unit_price, position")
              .eq("quote_id", quote.id)
              .order("position", { ascending: true });
            lines = (qli ?? []).map((l) => ({
              description: l.description ?? "",
              quantity: Number(l.quantity ?? 0),
              unit_price: Number(l.unit_price ?? 0),
            }));
          }
          if (lines.length === 0) {
            lines = [
              {
                description:
                  job.notes?.trim() || `Works completed${job.address ? ` at ${job.address}` : ""}`,
                quantity: 1,
                unit_price: Number(job.price ?? 0),
              },
            ];
          }

          const invVatRate = quote?.vat_rate != null ? Number(quote.vat_rate) : vatRate;
          const subtotal = Number(
            lines.reduce((s, l) => s + l.quantity * l.unit_price, 0).toFixed(2),
          );
          const total = Number((subtotal * (1 + invVatRate / 100)).toFixed(2));
          const due = new Date();
          due.setDate(due.getDate() + termsDays);

          const { data: inv, error } = await supabase
            .from("invoices")
            .insert({
              site_id: data.siteId,
              job_id: job.id,
              invoice_number: `INV-${year}-${String(seq).padStart(4, "0")}`,
              customer_name: job.customer_name,
              customer_email: quote?.customer_email ?? null,
              address: job.address ?? quote?.address ?? null,
              phone: phoneFromCalls(job.customer_name) ?? job.phone ?? quote?.phone ?? null,
              subtotal,
              vat_rate: invVatRate,
              total,
              status: "draft",
              due_date: due.toISOString().slice(0, 10),
              notes:
                [settings?.payment_methods, settings?.terms].filter(Boolean).join("\n\n") || null,
            })
            .select("id")
            .single();
          if (error) continue;
          seq += 1;

          await supabase.from("invoice_line_items").insert(
            lines.map((l, idx) => ({
              invoice_id: inv.id,
              description: l.description,
              quantity: l.quantity,
              unit_price: l.unit_price,
              line_total: Number((l.quantity * l.unit_price).toFixed(2)),
              position: idx,
            })),
          );
        }
      }
    }

    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("site_id", data.siteId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { invoices: invoices ?? [] };
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: invoice, error } = await context.supabase
      .from("invoices")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice) throw new Error("Invoice not found");
    const { data: items } = await context.supabase
      .from("invoice_line_items")
      .select("description, quantity, unit_price")
      .eq("invoice_id", data.id)
      .order("position", { ascending: true });
    const { data: business } = await context.supabase
      .from("quote_settings")
      .select(
        "business_name, trade, business_address, business_email, business_phone, website, company_number, vat_number, vat_registered, payment_methods, terms, logo_url",
      )
      .eq("site_id", invoice.site_id)
      .maybeSingle();
    return {
      invoice,
      business: business ?? null,

      items: (items ?? []).map((i) => ({
        description: i.description ?? "",
        quantity: Number(i.quantity ?? 0),
        unit_price: Number(i.unit_price ?? 0),
      })) as InvoiceLine[],
    };
  });

/** Saves manual amendments: header fields + line items, recalculating totals. */
export const saveInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      customer_name: string | null;
      customer_email: string | null;
      address: string | null;
      phone: string | null;
      vat_rate: number;
      due_date: string | null;

      notes: string | null;
      status?: InvoiceStatus;
      items: InvoiceLine[];
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const items = data.items.filter((i) => i.description.trim());
    const subtotal = Number(
      items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0).toFixed(2),
    );
    const total = Number((subtotal * (1 + Number(data.vat_rate || 0) / 100)).toFixed(2));

    const { data: before } = await supabase
      .from("invoices")
      .select("site_id, customer_name, phone, address")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabase

      .from("invoices")
      .update({
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        address: data.address,
        phone: data.phone,
        vat_rate: data.vat_rate,
        due_date: data.due_date,

        notes: data.notes,
        ...(data.status ? { status: data.status } : {}),
        subtotal,
        total,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (before) {
      const { propagateContact } = await import("@/lib/contact-sync.server");
      await propagateContact(supabase, {
        siteId: before.site_id,
        patch: {
          name: data.customer_name,
          phone: data.phone,
          address: data.address,
          email: data.customer_email,
        },
        previous: { name: before.customer_name, phone: before.phone },
        skip: { table: "invoices", id: data.id },
      });
    }

    await supabase.from("invoice_line_items").delete().eq("invoice_id", data.id);
    if (items.length > 0) {
      const { error: liErr } = await supabase.from("invoice_line_items").insert(
        items.map((i, idx) => ({
          invoice_id: data.id,
          description: i.description,
          quantity: Number(i.quantity || 0),
          unit_price: Number(i.unit_price || 0),
          line_total: Number((Number(i.quantity || 0) * Number(i.unit_price || 0)).toFixed(2)),
          position: idx,
        })),
      );
      if (liErr) throw new Error(liErr.message);
    }
    return { ok: true, subtotal, total };
  });

export const setInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: InvoiceStatus }) => data)
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const patch = {
      status: data.status,
      ...(data.status === "paid" ? { paid_at: now } : {}),
      ...(data.status === "approved" ? { approved_at: now } : {}),
    };
    const { error } = await context.supabase.from("invoices").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Approves the invoice and emails it to the customer with a payment link. */
export const approveAndSendInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; email?: string | null; origin?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice) throw new Error("Invoice not found");

    const recipient = (data.email || invoice.customer_email || "").trim();
    if (!recipient) throw new Error("Add a customer email before sending this invoice.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new Error("That email address does not look valid.");
    }

    const { data: items } = await supabase
      .from("invoice_line_items")
      .select("description, quantity, unit_price")
      .eq("invoice_id", invoice.id)
      .order("position", { ascending: true });

    const { data: settings } = await supabase
      .from("quote_settings")
      .select(
        "business_name, business_phone, business_email, business_address, company_number, vat_number, vat_registered, payment_methods, logo_url",
      )
      .eq("site_id", invoice.site_id)
      .maybeSingle();
    const origin = (data.origin || "").replace(/\/+$/, "");
    const logoUrl =
      settings?.logo_url && origin ? `${origin}/api/public/branding/logo/${invoice.site_id}` : null;

    const subtotal = Number(invoice.subtotal ?? 0);
    const vatRate = Number(invoice.vat_rate ?? 0);
    const vatAmount = Number(((subtotal * vatRate) / 100).toFixed(2));

    let paymentLink: string | null = null;
    try {
      const activeEnv = getStripeEnvironment();
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(activeEnv);

      const sessionLineItems = (items ?? []).map((i) => ({
        price_data: {
          currency: "gbp",
          product_data: {
            name: i.description ?? "Invoice Item",
          },
          unit_amount: Math.round(Number(i.unit_price) * 100),
        },
        quantity: Number(i.quantity || 1),
      }));

      if (vatAmount > 0) {
        sessionLineItems.push({
          price_data: {
            currency: "gbp",
            product_data: {
              name: `VAT (${vatRate}%)`,
            },
            unit_amount: Math.round(vatAmount * 100),
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: recipient,
        line_items: sessionLineItems,
        success_url: `${origin}/api/public/payments/success?invoice_id=${invoice.id}`,
        cancel_url: `${origin}/bookings/invoices`,
        metadata: {
          invoiceId: invoice.id,
        },
      });
      paymentLink = session.url ?? null;
    } catch (err) {
      console.error("[approveAndSendInvoice] Stripe checkout session creation failed:", err);
      throw new Error(
        `Stripe session creation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("invoice", recipient, {
      templateData: {
        businessName: settings?.business_name || "Atyvia",
        businessContact:
          [settings?.business_phone, settings?.business_email].filter(Boolean).join(" · ") || null,
        logoUrl,
        businessAddress: settings?.business_address || null,
        companyNumber: settings?.company_number || null,
        vatNumber: settings?.vat_registered ? settings?.vat_number || null : null,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        address: invoice.address,
        dueDate: invoice.due_date,
        subtotal,
        vatRate,
        vatAmount,
        total: Number(invoice.total ?? 0),
        notes: invoice.notes,
        paymentLink,
        paymentMethods: settings?.payment_methods || null,
        lineItems: (items ?? []).map((i) => ({
          description: i.description ?? "",
          quantity: Number(i.quantity ?? 0),
          unit_price: Number(i.unit_price ?? 0),
        })),
      },
      idempotencyKey: `invoice-${invoice.id}-${recipient}-${Date.now()}`,
    });

    if (!result.sent) {
      throw new Error(
        "That email address is blocked (previous bounce, complaint, or unsubscribe). Ask the customer for another address.",
      );
    }

    const now = new Date().toISOString();
    await supabase
      .from("invoices")
      .update({
        status: "sent",
        approved_at: invoice.approved_at ?? now,
        sent_at: now,
        customer_email: recipient,
      })
      .eq("id", invoice.id);

    if (invoice.job_id) {
      await supabase.from("jobs").update({ status: "invoiced" }).eq("id", invoice.job_id);
    }

    return { ok: true, recipient };
  });

/** Permanently delete an invoice and its line items. */
export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error: liErr } = await context.supabase
      .from("invoice_line_items")
      .delete()
      .eq("invoice_id", data.id);
    if (liErr) throw new Error(liErr.message);
    const { error } = await context.supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
