/**
 * Builds a printable invoice document and opens the browser's print dialog,
 * where the tradesperson can check the layout and "Save as PDF".
 */
export type InvoicePdfBusiness = {
  business_name?: string | null;
  trade?: string | null;
  business_address?: string | null;
  business_email?: string | null;
  business_phone?: string | null;
  website?: string | null;
  company_number?: string | null;
  vat_number?: string | null;
  vat_registered?: boolean | null;
  logo_url?: string | null;
} | null;

export type InvoicePdfInput = {
  invoiceNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  address: string | null;
  phone: string | null;
  dueDate: string | null;
  issuedDate: string | null;
  vatRate: number;
  notes: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
  business: InvoicePdfBusiness;
  logoUrl?: string | null;
};

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const money = (n: number) => `£${Number(n || 0).toFixed(2)}`;

const ukDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

export function buildInvoiceHtml(inv: InvoicePdfInput): string {
  const subtotal = inv.items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const vat = subtotal * (Number(inv.vatRate || 0) / 100);
  const total = subtotal + vat;
  const b = inv.business;

  const rows = inv.items
    .filter((i) => i.description.trim() || i.unit_price)
    .map(
      (i) => `<tr>
        <td>${esc(i.description)}</td>
        <td class="num">${Number(i.quantity || 0)}</td>
        <td class="num">${money(i.unit_price)}</td>
        <td class="num">${money(Number(i.quantity || 0) * Number(i.unit_price || 0))}</td>
      </tr>`,
    )
    .join("");

  const bizLines = [
    b?.business_address,
    [b?.business_phone, b?.business_email].filter(Boolean).join(" · "),
    b?.website,
    b?.company_number ? `Company no. ${b.company_number}` : null,
    b?.vat_registered && b?.vat_number ? `VAT no. ${b.vat_number}` : null,
  ]
    .filter(Boolean)
    .map((l) => `<div>${esc(l)}</div>`)
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(inv.invoiceNumber)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #14181f; margin: 0; font-size: 12px; }
  h1 { font-size: 26px; margin: 0; letter-spacing: -0.02em; }
  .head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 14px; }
  .biz { font-size: 11px; color: #5b6472; line-height: 1.5; }
  .logo { max-height: 56px; max-width: 190px; object-fit: contain; margin-bottom: 8px; display: block; }
  .biz strong { display: block; font-size: 15px; color: #14181f; margin-bottom: 2px; }
  .meta { text-align: right; font-size: 11px; color: #5b6472; line-height: 1.6; }
  .grid { display: flex; gap: 32px; margin: 22px 0 18px; }
  .grid section { flex: 1; }
  .label { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: #8b93a1; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #8b93a1; border-bottom: 1px solid #dfe3ea; padding: 6px 8px; }
  td { padding: 8px; border-bottom: 1px solid #eef0f4; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 260px; margin-top: 14px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 8px; }
  .totals .due { border-top: 2px solid #14181f; font-weight: 700; font-size: 14px; margin-top: 4px; padding-top: 8px; }
  .notes { margin-top: 26px; font-size: 11px; color: #5b6472; white-space: pre-wrap; border-top: 1px solid #eef0f4; padding-top: 12px; }
</style></head>
<body>
  <div class="head">
    <div class="biz">
      ${inv.logoUrl ? `<img class="logo" src="${esc(inv.logoUrl)}" alt="${esc(b?.business_name || "Logo")}" />` : ""}
      <strong>${esc(b?.business_name || "Invoice")}</strong>
      ${b?.trade ? `<div>${esc(b.trade)}</div>` : ""}
      ${bizLines}
    </div>
    <div>
      <h1>INVOICE</h1>
      <div class="meta">
        <div><strong>${esc(inv.invoiceNumber)}</strong></div>
        <div>Issued ${ukDate(inv.issuedDate)}</div>
        <div>Due ${ukDate(inv.dueDate)}</div>
      </div>
    </div>
  </div>

  <div class="grid">
    <section>
      <div class="label">Invoice to</div>
      <div><strong>${esc(inv.customerName || "Customer")}</strong></div>
      ${inv.address ? `<div>${esc(inv.address)}</div>` : ""}
      ${inv.phone ? `<div>${esc(inv.phone)}</div>` : ""}
      ${inv.customerEmail ? `<div>${esc(inv.customerEmail)}</div>` : ""}
    </section>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4">No items</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div><span>VAT (${Number(inv.vatRate || 0)}%)</span><span>${money(vat)}</span></div>
    <div class="due"><span>Amount due</span><span>${money(total)}</span></div>
  </div>

  ${inv.notes ? `<div class="notes">${esc(inv.notes)}</div>` : ""}
</body></html>`;
}

export function openInvoicePdf(inv: InvoicePdfInput) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) throw new Error("Allow pop-ups to generate the PDF.");
  win.document.write(buildInvoiceHtml(inv));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
