import { createServerFn } from '@tanstack/react-start'

// Public (unauthenticated) server functions used by the customer-facing
// quote acceptance + slot picking page. The respond_token IS the credential —
// no sign-in required. Never return anything beyond the quote's own details.

type PublicQuote = {
  quoteId: string
  status: string
  customerName: string | null
  address: string | null
  total: number
  jobId: string | null
  durationMinutes: number
  scheduled: { date: string; time: string | null } | null
}

async function loadByToken(token: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .select('id, status, customer_name, customer_email, address, phone, total, notes')
    .eq('respond_token', token)
    .maybeSingle()
  if (!quote) throw new Error('Quote not found')
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('id, scheduled_date, scheduled_time, duration_minutes, cal_booking_id')
    .eq('quote_id', quote.id)
    .maybeSingle()
  return { supabaseAdmin, quote, job }
}

export const getQuoteForBooking = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<PublicQuote> => {
    const { quote, job } = await loadByToken(data.token)
    return {
      quoteId: quote.id,
      status: quote.status,
      customerName: quote.customer_name,
      address: quote.address,
      total: Number(quote.total ?? 0),
      jobId: job?.id ?? null,
      durationMinutes: job?.duration_minutes ?? 120,
      scheduled: job?.scheduled_date
        ? { date: job.scheduled_date, time: job.scheduled_time ?? null }
        : null,
    }
  })

/** Available Cal.com slots for the job event type, keyed by ISO date. */
export const listJobSlots = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string; days?: number }) => data)
  .handler(async ({ data }) => {
    const { job } = await loadByToken(data.token)
    const apiKey = process.env['CAL_COM_API_KEY']
    const etId = process.env['CAL_COM_JOB_EVENT_TYPE_ID']
    if (!apiKey || !etId || !/^\d+$/.test(etId)) {
      return { configured: false as const, slots: {} as Record<string, string[]> }
    }

    const duration = job?.duration_minutes && job.duration_minutes > 0 ? job.duration_minutes : 120
    const start = new Date()
    start.setDate(start.getDate() + 1)
    const end = new Date(start)
    end.setDate(end.getDate() + (data.days ?? 21))

    const url = new URL('https://api.cal.com/v2/slots')
    url.searchParams.set('eventTypeId', etId)
    url.searchParams.set('start', start.toISOString().slice(0, 10))
    url.searchParams.set('end', end.toISOString().slice(0, 10))
    url.searchParams.set('duration', String(duration))
    url.searchParams.set('timeZone', 'Europe/London')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': '2024-09-04' },
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[cal.com] slots failed [${res.status}]: ${body}`)
      return { configured: true as const, slots: {} as Record<string, string[]>, error: `Could not load availability (${res.status})` }
    }
    const json = (await res.json()) as { data?: Record<string, Array<{ start: string } | string>> }
    const slots: Record<string, string[]> = {}
    for (const [day, list] of Object.entries(json.data ?? {})) {
      const times = (list ?? [])
        .map((s) => (typeof s === 'string' ? s : s.start))
        .filter(Boolean)
      if (times.length) slots[day] = times
    }
    return { configured: true as const, slots, durationMinutes: duration }
  })

/** Customer picks a slot: book it in Cal.com and schedule the job. */
export const bookJobSlot = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; start: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin, quote, job } = await loadByToken(data.token)
    if (!job) throw new Error('No job found for this quote yet — please contact us.')

    const startDate = new Date(data.start)
    if (Number.isNaN(startDate.getTime())) throw new Error('Invalid slot')

    const duration = job.duration_minutes && job.duration_minutes > 0 ? job.duration_minutes : 120
    const local = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(startDate)
    const part = (t: string) => local.find((p) => p.type === t)?.value ?? '00'
    const scheduledDate = `${part('year')}-${part('month')}-${part('day')}`
    const scheduledTime = `${part('hour')}:${part('minute')}`

    const apiKey = process.env['CAL_COM_API_KEY']
    const etId = process.env['CAL_COM_JOB_EVENT_TYPE_ID']
    let calBookingId: string | null = null

    if (apiKey && etId && /^\d+$/.test(etId)) {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': '2024-08-13',
        'Content-Type': 'application/json',
      }
      if (job.cal_booking_id) {
        await fetch(`https://api.cal.com/v2/bookings/${job.cal_booking_id}/cancel`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ cancellationReason: 'Customer picked a new slot' }),
        }).catch(() => {})
      }
      const attendeeEmail = quote.customer_email || `job-${job.id}@atyvia.app`
      const res = await fetch('https://api.cal.com/v2/bookings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          start: startDate.toISOString(),
          eventTypeId: Number(etId),
          lengthInMinutes: duration,
          attendee: {
            name: quote.customer_name || 'Customer',
            email: attendeeEmail,
            timeZone: 'Europe/London',
            language: 'en',
            ...(quote.phone ? { phoneNumber: quote.phone } : {}),
          },
          bookingFieldsResponses: {
            title: `Job visit — ${quote.customer_name || 'Customer'}`,
            name: quote.customer_name || 'Customer',
            email: attendeeEmail,
            attendeePhoneNumber: quote.phone || '',
            jobAddress: quote.address || 'TBC',
            notes: quote.notes || '',
          },
          metadata: { source: 'atyvia-job', job_id: job.id },
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error(`[cal.com] customer job booking failed [${res.status}]: ${body}`)
        throw new Error('That slot has just been taken — please pick another.')
      }
      const j = (await res.json()) as { data?: { uid?: string; id?: number } }
      calBookingId = j.data?.uid || (j.data?.id != null ? String(j.data.id) : null)
    }

    const { error } = await supabaseAdmin
      .from('jobs')
      .update({
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        duration_minutes: duration,
        status: 'booked',
        ...(calBookingId ? { cal_booking_id: calBookingId } : {}),
      })
      .eq('id', job.id)
    if (error) throw new Error(error.message)

    return { ok: true, scheduledDate, scheduledTime, durationMinutes: duration }
  })
