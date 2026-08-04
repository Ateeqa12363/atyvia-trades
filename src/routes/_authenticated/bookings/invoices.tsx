import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Receipt, Plus, Trash2, Send, CheckCircle2, Loader2, FileDown } from "lucide-react";
import { openInvoicePdf } from "@/lib/invoice-pdf";

import { format } from "date-fns";
import { toast } from "sonner";
import { GatedPage } from "@/components/GatedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import {
  listInvoices,
  getInvoice,
  saveInvoice,
  setInvoiceStatus,
  deleteInvoice,
  approveAndSendInvoice,
  type InvoiceLine,
  type InvoiceStatus,
} from "@/lib/invoices.functions";

export const Route = createFileRoute("/_authenticated/bookings/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — Atyvia" },
      {
        name: "description",
        content: "Completed jobs turn into draft invoices — check, amend and send them with a payment link.",
      },
      { property: "og:title", content: "Invoices — Atyvia" },
      {
        property: "og:description",
        content: "Approve invoices for completed jobs and email them to customers instantly.",
      },
    ],
  }),
  component: InvoicesPage,
});

type Invoice = {
  id: string;
  site_id: string;

  invoice_number: string;
  customer_name: string | null;
  customer_email: string | null;
  address: string | null;
  phone: string | null;
  subtotal: number;
  vat_rate: number;
  total: number;
  status: InvoiceStatus;
  
  due_date: string | null;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
};

const fmt = (n: number) => `£${Number(n ?? 0).toFixed(2)}`;

const STATUS: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Needs review", className: "border-primary/40 text-primary" },
  approved: { label: "Approved", className: "border-primary/40 text-primary" },
  sent: { label: "Sent", className: "border-secondary/50 text-secondary" },
  paid: { label: "Paid", className: "border-emerald-500/50 text-emerald-600" },
};

function InvoicesPage() {
  const { selectedSiteId } = useSelectedSite();
  const queryClient = useQueryClient();
  const fetchInvoices = useServerFn(listInvoices);
  const statusFn = useServerFn(setInvoiceStatus);
  const deleteFn = useServerFn(deleteInvoice);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", selectedSiteId],
    queryFn: () => fetchInvoices({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
  });
  const invoices = (data?.invoices ?? []) as Invoice[];

  const markPaid = useMutation({
    mutationFn: (id: string) => statusFn({ data: { id, status: "paid" } }),
    onSuccess: () => {
      toast.success("Invoice marked paid");
      queryClient.invalidateQueries({ queryKey: ["invoices", selectedSiteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeInvoice = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Invoice deleted");
      queryClient.invalidateQueries({ queryKey: ["invoices", selectedSiteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const drafts = invoices.filter((i) => i.status === "draft" || i.status === "approved");
  const issued = invoices.filter((i) => i.status === "sent" || i.status === "paid");

  return (
    <GatedPage>
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Bookings · Invoices
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every completed job lands here as a draft invoice. Check it, amend anything, then approve
            and send — the customer gets it by email with your payment link.
          </p>
        </div>

        {isLoading ? (
          <div className="glass-card rounded-2xl p-12 text-center text-sm text-muted-foreground">
            Loading invoices…
          </div>
        ) : invoices.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <h3 className="text-sm font-semibold">No invoices yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Mark a job as complete and its invoice will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <Group title="Ready to check & send" rows={drafts} onOpen={setOpenId} onPaid={markPaid.mutate} onDelete={removeInvoice.mutate} />
            <Group title="Issued" rows={issued} onOpen={setOpenId} onPaid={markPaid.mutate} onDelete={removeInvoice.mutate} />
          </div>
        )}
      </div>

      {openId && (
        <InvoiceDialog
          id={openId}
          onClose={() => setOpenId(null)}
          onDone={() => {
            setOpenId(null);
            queryClient.invalidateQueries({ queryKey: ["invoices", selectedSiteId] });
            queryClient.invalidateQueries({ queryKey: ["jobs", selectedSiteId] });
          }}
        />
      )}
    </GatedPage>
  );
}

function Group({
  title,
  rows,
  onOpen,
  onPaid,
  onDelete,
}: {
  title: string;
  rows: Invoice[];
  onOpen: (id: string) => void;
  onPaid: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
      </div>
      <div className="space-y-2">
        {rows.map((inv) => (
          <div
            key={inv.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
          >
            <button type="button" onClick={() => onOpen(inv.id)} className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{inv.customer_name || "Customer"}</span>
                <Badge variant="outline" className={`text-[10px] ${STATUS[inv.status].className}`}>
                  {STATUS[inv.status].label}
                </Badge>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {inv.invoice_number}
                {inv.address ? ` · ${inv.address}` : ""}
                {inv.due_date ? ` · due ${format(new Date(inv.due_date), "PP")}` : ""}
              </div>
            </button>
            <div className="text-right text-sm font-semibold">{fmt(inv.total)}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => onOpen(inv.id)}>
                {inv.status === "draft" ? "Check & send" : "View"}
              </Button>
              {inv.status === "sent" && (
                <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={() => onPaid(inv.id)}>
                  Mark paid
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                aria-label="Delete invoice"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (confirm(`Delete invoice ${inv.invoice_number} permanently?`)) onDelete(inv.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InvoiceDialog({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const fetchOne = useServerFn(getInvoice);
  const saveFn = useServerFn(saveInvoice);
  const sendFn = useServerFn(approveAndSendInvoice);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    address: "",
    phone: "",
    vat_rate: 20,
    due_date: "",
    notes: "",
  });

  const [items, setItems] = useState<InvoiceLine[]>([]);
  const [busy, setBusy] = useState<"save" | "send" | null>(null);

  useEffect(() => {
    if (!data) return;
    const inv = data.invoice as unknown as Invoice;
    setForm({
      customer_name: inv.customer_name ?? "",
      customer_email: inv.customer_email ?? "",
      address: inv.address ?? "",
      phone: inv.phone ?? "",
      vat_rate: Number(inv.vat_rate ?? 20),
      due_date: inv.due_date ?? "",

      notes: inv.notes ?? "",
    });
    setItems(data.items.length ? data.items : [{ description: "", quantity: 1, unit_price: 0 }]);
  }, [data]);

  const invoice = data?.invoice as unknown as Invoice | undefined;
  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const vat = subtotal * (Number(form.vat_rate || 0) / 100);
  const total = subtotal + vat;

  const patchItem = (i: number, p: Partial<InvoiceLine>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const generatePdf = () => {
    if (!invoice) return;
    try {
      openInvoicePdf({
        invoiceNumber: invoice.invoice_number,
        customerName: form.customer_name || null,
        customerEmail: form.customer_email || null,
        address: form.address || null,
        phone: form.phone || null,
        dueDate: form.due_date || null,
        issuedDate: invoice.created_at ?? null,
        vatRate: Number(form.vat_rate || 0),
        notes: form.notes || null,
        items,
        business: (data?.business ?? null) as never,
        logoUrl:
          data?.business && (data.business as { logo_url?: string }).logo_url && invoice.site_id
            ? `${window.location.origin}/api/public/branding/logo/${invoice.site_id}`
            : null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the PDF.");
    }
  };

  const payload = (status?: InvoiceStatus) => ({
    id,
    customer_name: form.customer_name.trim() || null,
    customer_email: form.customer_email.trim() || null,
    address: form.address.trim() || null,
    phone: form.phone.trim() || null,
    vat_rate: Number(form.vat_rate || 0),
    due_date: form.due_date || null,
    
    notes: form.notes.trim() || null,
    ...(status ? { status } : {}),
    items,
  });

  const save = async () => {
    setBusy("save");
    try {
      await saveFn({ data: payload() });
      toast.success("Invoice saved");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };

  const approveSend = async () => {
    if (!form.customer_email.trim()) {
      toast.error("Add a customer email to send this invoice.");
      return;
    }
    setBusy("send");
    try {
      await saveFn({ data: payload("approved") });
      const res = await sendFn({ data: { id, email: form.customer_email.trim(), origin: window.location.origin } });
      toast.success(`Invoice sent to ${res.recipient}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the invoice.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {invoice?.invoice_number || "Invoice"}
          </DialogTitle>
          <DialogDescription>
            Amend anything you need, then approve & send — the customer gets it by email with your
            payment link.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer">
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm((f) => ({ ...f, customer_name: e.currentTarget.value }))}
                />
              </Field>
              <Field label="Customer email">
                <Input
                  type="email"
                  value={form.customer_email}
                  placeholder="name@email.com"
                  onChange={(e) => setForm((f) => ({ ...f, customer_email: e.currentTarget.value }))}
                />
              </Field>
              <Field label="Address">
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.currentTarget.value }))}
                />
              </Field>
              <Field label="Phone">
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.currentTarget.value }))}
                />
              </Field>
              <Field label="Due date">
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.currentTarget.value }))}
                />
              </Field>
              <Field label="VAT rate (%)">
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.vat_rate}
                  onChange={(e) => setForm((f) => ({ ...f, vat_rate: Number(e.currentTarget.value) || 0 }))}
                />
              </Field>
            </div>


            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Line items</Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unit_price: 0 }])}
                >
                  <Plus className="h-3 w-3" /> Add line
                </Button>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_6rem_2rem] items-center gap-2">
                  <Input
                    value={it.description}
                    placeholder="Description"
                    onChange={(e) => patchItem(i, { description: e.currentTarget.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={it.quantity}
                    onChange={(e) => patchItem(i, { quantity: Number(e.currentTarget.value) || 0 })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.unit_price}
                    onChange={(e) => patchItem(i, { unit_price: Number(e.currentTarget.value) || 0 })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    aria-label="Remove line"
                    onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
              <Row label="Subtotal" value={fmt(subtotal)} />
              <Row label={`VAT (${form.vat_rate}%)`} value={fmt(vat)} />
              <Separator className="my-2" />
              <Row label="Amount due" value={fmt(total)} strong />
            </div>

            <Field label="Notes / terms shown on the invoice">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.currentTarget.value }))}
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="outline" onClick={generatePdf} disabled={busy !== null} className="gap-2">
                <FileDown className="h-4 w-4" />
                Generate PDF
              </Button>
              <Button variant="outline" onClick={save} disabled={busy !== null} className="gap-2">
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save changes
              </Button>

              <Button onClick={approveSend} disabled={busy !== null} className="gap-2">
                {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Approve & send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
