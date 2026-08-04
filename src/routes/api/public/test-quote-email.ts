import { createFileRoute } from '@tanstack/react-router'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

export const Route = createFileRoute('/api/public/test-quote-email')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const to = new URL(request.url).searchParams.get('to')
        if (!to) return new Response('Missing ?to=', { status: 400 })
        const result = await sendTemplateEmail('quote-offer', to, {
          templateData: {
            customerName: 'Ateeq',
            businessName: 'Atyvia',
            address: '123 Test Lane, London',
            subtotal: 500,
            vatRate: 0.2,
            vatAmount: 100,
            total: 600,
            notes: 'This is a test quote email to verify delivery.',
            lineItems: [
              { description: 'Test service', quantity: 1, unit_price: 500 },
            ],
            acceptUrl: 'https://example.com/accept',
            declineUrl: 'https://example.com/decline',
          },
          idempotencyKey: `test-quote-${Date.now()}`,
        })
        return Response.json(result)
      },
    },
  },
})
