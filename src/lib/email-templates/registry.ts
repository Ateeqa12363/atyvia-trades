import type { ComponentType } from 'react'
import { template as quoteOfferTemplate } from './quote-offer'
import { template as invoiceTemplate } from './invoice'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'quote-offer': quoteOfferTemplate,
  invoice: invoiceTemplate,
}
