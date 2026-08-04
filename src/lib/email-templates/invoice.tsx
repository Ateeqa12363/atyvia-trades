import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
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
  businessName?: string
  businessContact?: string | null
  logoUrl?: string | null
  businessAddress?: string | null
  vatNumber?: string | null
  companyNumber?: string | null
  invoiceNumber?: string
  customerName?: string | null
  address?: string | null
  dueDate?: string | null
  subtotal?: number
  vatRate?: number
  vatAmount?: number
  total?: number
  notes?: string | null
  paymentLink?: string | null
  paymentMethods?: string | null
  lineItems?: LineItem[]
}

const fmt = (n: number) =>
  `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const InvoiceEmail = ({
  businessName = 'Atyvia',
  businessContact,
  logoUrl,
  businessAddress,
  vatNumber,
  companyNumber,
  invoiceNumber = '',
  customerName,
  address,
  dueDate,
  subtotal = 0,
  vatRate = 20,
  vatAmount = 0,
  total = 0,
  notes,
  paymentLink,
  paymentMethods,
  lineItems = [],
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Invoice {invoiceNumber} from {businessName} — {fmt(total)}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {logoUrl && (
          <Section style={{ marginBottom: '8px' }}>
            <Img src={logoUrl} alt={businessName} height="48" style={{ maxHeight: '48px' }} />
          </Section>
        )}
        <Text style={bizBlock}>
          <strong>{businessName}</strong>
          {businessAddress ? <><br />{businessAddress}</> : null}
          {businessContact ? <><br />{businessContact}</> : null}
          {companyNumber ? <><br />Company no. {companyNumber}</> : null}
          {vatNumber ? <><br />VAT no. {vatNumber}</> : null}
        </Text>
        <Heading style={h1}>Invoice {invoiceNumber}</Heading>
        <Text style={paragraph}>{customerName ? `Hi ${customerName},` : 'Hi there,'}</Text>
        <Text style={paragraph}>
          Thanks for your business. Here's the invoice for the completed work
          {address ? ` at ${address}` : ''}
          {dueDate ? `. Payment is due by ${dueDate}` : ''}.
        </Text>

        {lineItems.length > 0 && (
          <Section style={itemsBox}>
            {lineItems.map((li, i) => (
              <div key={i} style={itemRow}>
                <Text style={itemDesc}>
                  {li.description || 'Item'} <span style={itemQty}>× {li.quantity}</span>
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
            <Text style={grandLabel}>Amount due</Text>
            <Text style={grandValue}>{fmt(total)}</Text>
          </div>
        </Section>

        {paymentLink && (
          <Section style={{ textAlign: 'center', margin: '28px 0 12px' }}>
            <Button href={paymentLink} style={payBtn}>
              Pay {fmt(total)} now
            </Button>
          </Section>
        )}

        {paymentMethods && (
          <Text style={paragraph}>
            <strong>How to pay:</strong> {paymentMethods}
          </Text>
        )}

        {notes && (
          <Section style={notesBox}>
            <Text style={notesLabel}>Notes</Text>
            <Text style={notesText}>{notes}</Text>
          </Section>
        )}

        <Text style={footer}>Any questions about this invoice, just reply to this email.</Text>
        <Text style={footerSmall}>
          — {businessName}
          {businessContact ? ` · ${businessContact}` : ''}
        </Text>
      </Container>
    </Body>
  </Html>
)

const bizBlock: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: '#5b6472',
  margin: '0 0 16px',
}

export const template = {
  component: InvoiceEmail,
  subject: (data: Record<string, any>) =>
    `Invoice ${data.invoiceNumber ?? ''} from ${data.businessName ?? 'Atyvia'}${
      data.total ? ` — ${fmt(Number(data.total))}` : ''
    }`.replace(/\s+/g, ' '),
  displayName: 'Invoice — Amount due',
  previewData: {
    businessName: 'A&K Plumbing',
    invoiceNumber: 'INV-2026-0001',
    customerName: 'Sarah',
    address: '12 Oak Lane, London',
    dueDate: '2026-08-14',
    subtotal: 400,
    vatRate: 20,
    vatAmount: 80,
    total: 480,
    paymentLink: 'https://example.com/pay',
    paymentMethods: 'Bank transfer or card',
    lineItems: [{ description: 'Boiler replacement', quantity: 1, unit_price: 400 }],
    notes: 'Payment due within 14 days.',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
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
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: 600, color: '#0f172a', margin: '0 0 16px' }
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
}
const itemDesc: React.CSSProperties = { fontSize: '14px', color: '#0f172a', margin: '8px 0' }
const itemQty: React.CSSProperties = { color: '#64748b' }
const itemPrice: React.CSSProperties = {
  fontSize: '14px',
  color: '#0f172a',
  margin: '8px 0',
  whiteSpace: 'nowrap',
}
const totalsBox: React.CSSProperties = { marginTop: '16px' }
const totalsRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between' }
const totalsLabel: React.CSSProperties = { fontSize: '14px', color: '#64748b', margin: '4px 0' }
const totalsValue: React.CSSProperties = { fontSize: '14px', color: '#0f172a', margin: '4px 0' }
const grandLabel: React.CSSProperties = { fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: '6px 0' }
const grandValue: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '6px 0' }
const hr: React.CSSProperties = { borderColor: '#e5e7eb', margin: '10px 0' }
const notesBox: React.CSSProperties = {
  marginTop: '20px',
  padding: '12px 14px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
}
const notesLabel: React.CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#64748b',
  margin: '0 0 6px',
}
const notesText: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '21px',
  color: '#334155',
  margin: 0,
  whiteSpace: 'pre-line',
}
const payBtn: React.CSSProperties = {
  backgroundColor: '#4338ca',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
}
const footer: React.CSSProperties = { fontSize: '13px', color: '#64748b', margin: '20px 0 4px' }
const footerSmall: React.CSSProperties = { fontSize: '13px', color: '#94a3b8', margin: 0 }
