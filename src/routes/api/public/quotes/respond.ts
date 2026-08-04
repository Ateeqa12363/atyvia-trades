import { createFileRoute } from '@tanstack/react-router'

// GET /api/public/quotes/respond?token=...&action=accept|decline
// Called from the customer's email. Unauthenticated: token is the credential.
export const Route = createFileRoute('/api/public/quotes/respond')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const token = url.searchParams.get('token') ?? ''
        const action = url.searchParams.get('action') ?? ''

        if (!token || (action !== 'accept' && action !== 'decline')) {
          return htmlResponse(
            400,
            'Invalid link',
            'This response link is missing or malformed. Please check the email you received.',
            'error',
          )
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        const { data: quote, error } = await supabaseAdmin
          .from('quotes')
          .select('id, status, customer_name, total, respond_token')
          .eq('respond_token', token)
          .maybeSingle()

        if (error || !quote) {
          return htmlResponse(
            404,
            'Quote not found',
            'We couldn’t find the quote for this link. It may have been cancelled — please contact us.',
            'error',
          )
        }

        // Determine the new status. Customers can flip decline → accept themselves.
        const now = new Date().toISOString()
        const patch =
          action === 'accept'
            ? { status: 'accepted' as const, accepted_at: now, declined_at: null, responded_by: 'customer' }
            : { status: 'declined' as const, declined_at: now, responded_by: 'customer' }

        const { error: updErr } = await supabaseAdmin
          .from('quotes')
          .update(patch)
          .eq('id', quote.id)

        if (updErr) {
          return htmlResponse(
            500,
            'Something went wrong',
            'We couldn’t record your response. Please try again in a minute, or reply to the email.',
            'error',
          )
        }

        // Auto-create a job on accept (idempotent).
        if (action === 'accept') {
          const { data: q } = await supabaseAdmin
            .from('quotes')
            .select('id, site_id, site_visit_id, customer_name, address, total')
            .eq('id', quote.id)
            .single()
          if (q) {
            const { data: existing } = await supabaseAdmin
              .from('jobs')
              .select('id')
              .eq('quote_id', q.id)
              .maybeSingle()
            if (!existing) {
              await supabaseAdmin.from('jobs').insert({
                site_id: q.site_id,
                quote_id: q.id,
                site_visit_id: q.site_visit_id,
                customer_name: q.customer_name,
                address: q.address,
                price: q.total,
                status: 'booked',
              })
            }
          }
        }

        // On accept, send the customer straight to the slot picker (no sign-in needed).
        if (action === 'accept') {
          return new Response(null, {
            status: 302,
            headers: {
              location: `${url.origin}/q/${encodeURIComponent(token)}/book`,
              'cache-control': 'no-store',
            },
          })
        }

        return htmlResponse(
          200,
          'Quote declined',
          `Thanks for letting us know. If you change your mind you can accept from the same email, or reply and we'll adjust the quote.`,
          'info',
        )

      },
    },
  },
})

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}

function htmlResponse(
  status: number,
  heading: string,
  body: string,
  tone: 'success' | 'error' | 'info',
) {
  const accent =
    tone === 'success' ? '#10b981' : tone === 'error' ? '#ef4444' : '#0ea5e9'
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(heading)} — Atyvia</title>
    <style>
      body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:#f8fafc; color:#0f172a; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { max-width:520px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; padding:36px 32px; box-shadow:0 10px 30px rgba(15,23,42,.06); text-align:center; }
      .dot { width:56px; height:56px; border-radius:999px; background:${accent}22; color:${accent}; display:inline-flex; align-items:center; justify-content:center; font-size:28px; margin-bottom:16px; font-weight:700; }
      h1 { font-size:22px; margin:0 0 8px; }
      p { font-size:15px; line-height:22px; color:#475569; margin:0; }
      .brand { margin-top:24px; font-size:12px; color:#94a3b8; letter-spacing:.08em; text-transform:uppercase; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="dot">${tone === 'success' ? '✓' : tone === 'error' ? '!' : 'i'}</div>
        <h1>${escapeHtml(heading)}</h1>
        <p>${body}</p>
        <div class="brand">Atyvia</div>
      </div>
    </div>
  </body>
</html>`
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
