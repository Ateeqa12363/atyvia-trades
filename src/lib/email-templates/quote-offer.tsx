import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface LineItem {
  description: string
  quantity: number
  unit_price: number
}

interface Props {
  customerName?: string | null
  businessName?: string
  address?: string | null
  subtotal?: number
  vatRate?: number
  vatAmount?: number
  total?: number
  notes?: string | null
  lineItems?: LineItem[]
  acceptUrl?: string
  declineUrl?: string
}

const fmt = (n: number) =>
  `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const QuoteOfferEmail = ({
  customerName,
  businessName = 'Atyvia',
  address,
  subtotal = 0,
  vatRate = 20,
  vatAmount = 0,
  total = 0,
  notes,
  lineItems = [],
  acceptUrl = '#',
  declineUrl = '#',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your quote from {businessName} — {fmt(total)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your quote is ready</Heading>
        <Text style={paragraph}>
          {customerName ? `Hi ${customerName},` : 'Hi there,'}
        </Text>
        <Text style={paragraph}>
          Thanks for having us out. Here's the quote for the work
          {address ? ` at ${address}` : ''}. You can accept or decline below —
          it takes one click.
        </Text>

        {lineItems.length > 0 && (
          <Section style={itemsBox}>
            {lineItems.map((li, i) => (
              <div key={i} style={itemRow}>
                <Text style={itemDesc}>
                  {li.description || 'Item'}{' '}
                  <span style={itemQty}>× {li.quantity}</span>
                </Text>
                <Text style={itemPrice}>{fmt(li.quantity * li.unit_price)}</Text>
              </div>
            ))}
          </Section>
        )}

        <Section style={totalsBox}>
          <div style={totalsRow}>
            <Text style={totalsLabel}>Subtotal</Text>
            <Text style={totalsValue}>{fmt(subtotal)}</Text>
          </div>
          <div style={totalsRow}>
            <Text style={totalsLabel}>VAT ({vatRate}%)</Text>
            <Text style={totalsValue}>{fmt(vatAmount)}</Text>
          </div>
          <Hr style={hr} />
          <div style={totalsRow}>
            <Text style={grandLabel}>Total</Text>
            <Text style={grandValue}>{fmt(total)}</Text>
          </div>
        </Section>

        {notes && (
          <Section style={notesBox}>
            <Text style={notesLabel}>Notes</Text>
            <Text style={notesText}>{notes}</Text>
          </Section>
        )}

        <Section style={{ textAlign: 'center', margin: '32px 0 12px' }}>
          <Button href={acceptUrl} style={acceptBtn}>
            Accept quote
          </Button>
        </Section>
        <Section style={{ textAlign: 'center', margin: '0 0 24px' }}>
          <Button href={declineUrl} style={declineBtn}>
            Decline
          </Button>
        </Section>

        <Text style={footer}>
          Reply to this email if anything looks off — happy to adjust before you decide.
        </Text>
        <Text style={footerSmall}>— {businessName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: QuoteOfferEmail,
  subject: (data: Record<string, any>) =>
    `Your quote from ${data.businessName ?? 'Atyvia'}${data.total ? ` — ${fmt(Number(data.total))}` : ''}`,
  displayName: 'Quote — Accept or Decline',
  previewData: {
    customerName: 'Sarah',
    address: '12 Oak Lane, London',
    subtotal: 400,
    vatRate: 20,
    vatAmount: 80,
    total: 480,
    lineItems: [
      { description: 'Boiler service', quantity: 1, unit_price: 250 },
      { description: 'Radiator flush', quantity: 3, unit_price: 50 },
    ],
    notes: 'Includes parts and labour. Valid for 30 days.',
    acceptUrl: 'https://example.com/accept',
    declineUrl: 'https://example.com/decline',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  padding: '24px 0',
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '28px 28px 32px',
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
}
const h1: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 600,
  color: '#0f172a',
  margin: '0 0 16px',
}
const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '22px',
  color: '#334155',
  margin: '0 0 12px',
}
const itemsBox: React.CSSProperties = {
  marginTop: '20px',
  padding: '4px 0',
  borderTop: '1px solid #e5e7eb',
  borderBottom: '1px solid #e5e7eb',
}
const itemRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '10px 0',
  borderBottom: '1px solid #f1f5f9',
}
const itemDesc: React.CSSProperties = {
  fontSize: '14px',
  color: '#0f172a',
  margin: 0,
}
const itemQty: React.CSSProperties = { color: '#64748b', fontSize: '13px' }
const itemPrice: React.CSSProperties = {
  fontSize: '14px',
  color: '#0f172a',
  fontWeight: 500,
  margin: 0,
  whiteSpace: 'nowrap',
}
const totalsBox: React.CSSProperties = { marginTop: '16px' }
const totalsRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '2px 0',
}
const totalsLabel: React.CSSProperties = {
  fontSize: '13px',
  color: '#64748b',
  margin: 0,
}
const totalsValue: React.CSSProperties = {
  fontSize: '13px',
  color: '#0f172a',
  margin: 0,
}
const grandLabel: React.CSSProperties = {
  fontSize: '15px',
  color: '#0f172a',
  fontWeight: 600,
  margin: 0,
}
const grandValue: React.CSSProperties = {
  fontSize: '18px',
  color: '#0f172a',
  fontWeight: 700,
  margin: 0,
}
const hr: React.CSSProperties = { borderColor: '#e5e7eb', margin: '10px 0' }
const notesBox: React.CSSProperties = {
  marginTop: '20px',
  padding: '12px 14px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
}
const notesLabel: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#64748b',
  margin: '0 0 4px',
}
const notesText: React.CSSProperties = {
  fontSize: '13px',
  color: '#334155',
  margin: 0,
  whiteSpace: 'pre-wrap',
}
const acceptBtn: React.CSSProperties = {
  backgroundColor: '#10b981',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const declineBtn: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#334155',
  padding: '10px 24px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  textDecoration: 'none',
  border: '1px solid #cbd5e1',
  display: 'inline-block',
}
const footer: React.CSSProperties = {
  fontSize: '13px',
  color: '#64748b',
  margin: '20px 0 4px',
}
const footerSmall: React.CSSProperties = {
  fontSize: '13px',
  color: '#94a3b8',
  margin: 0,
}
