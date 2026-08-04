import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const sendQuoteToCustomer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { quoteId: string; email?: string | null; origin: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context

    const { data: quote, error } = await supabase
      .from('quotes')
      .select(
        'id, site_id, site_visit_id, customer_name, customer_email, address, subtotal, vat_rate, total, notes, respond_token, status',
      )
      .eq('id', data.quoteId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!quote) throw new Error('Quote not found')

    // Resolve recipient: explicit arg > stored on quote > site_visit.customer_email
    let recipient = (data.email || quote.customer_email || '').trim()
    if (!recipient && quote.site_visit_id) {
      const { data: v } = await supabase
        .from('site_visits')
        .select('customer_email')
        .eq('id', quote.site_visit_id)
        .maybeSingle()
      recipient = (v?.customer_email ?? '').trim()
    }
    if (!recipient) {
      throw new Error(
        'No customer email on file — enter one before sending, or capture it in Cal.com.',
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new Error('That email address does not look valid.')
    }

    // Ensure a respond_token exists.
    let token = quote.respond_token
    if (!token) {
      const { randomBytes } = await import('node:crypto')
      token = randomBytes(24).toString('hex')
      const { error: tokErr } = await supabase
        .from('quotes')
        .update({ respond_token: token })
        .eq('id', quote.id)
      if (tokErr) throw new Error(tokErr.message)
    }

    // Load line items for the email body.
    const { data: items } = await supabase
      .from('quote_line_items')
      .select('description, quantity, unit_price')
      .eq('quote_id', quote.id)
      .order('position', { ascending: true })

    const origin = data.origin.replace(/\/+$/, '')
    const acceptUrl = `${origin}/api/public/quotes/respond?token=${encodeURIComponent(token)}&action=accept`
    const declineUrl = `${origin}/api/public/quotes/respond?token=${encodeURIComponent(token)}&action=decline`

    const subtotal = Number(quote.subtotal ?? 0)
    const vatRate = Number(quote.vat_rate ?? 20)
    const total = Number(quote.total ?? 0)
    const vatAmount = Number((subtotal * vatRate / 100).toFixed(2))

    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    const result = await sendTemplateEmail('quote-offer', recipient, {
      templateData: {
        customerName: quote.customer_name,
        address: quote.address,
        subtotal,
        vatRate,
        vatAmount,
        total,
        notes: quote.notes,
        lineItems: (items ?? []).map((li) => ({
          description: li.description ?? '',
          quantity: Number(li.quantity ?? 0),
          unit_price: Number(li.unit_price ?? 0),
        })),
        acceptUrl,
        declineUrl,
      },
      idempotencyKey: `quote-offer-${quote.id}-${recipient}-${Date.now()}`,
    })

    if (!result.sent) {
      throw new Error(
        'That email address is blocked (previous bounce, complaint, or unsubscribe). Ask the customer to give an alternative address.',
      )
    }

    // Mark sent + save email on the quote for later.
    const now = new Date().toISOString()
    await supabase
      .from('quotes')
      .update({
        status: 'sent',
        sent_at: now,
        customer_email: recipient,
      })
      .eq('id', quote.id)

    return { ok: true, recipient }
  })
