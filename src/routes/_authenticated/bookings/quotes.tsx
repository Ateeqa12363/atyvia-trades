import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { FileText, Plus, Trash2, Send, CheckCircle2, XCircle, MapPin, Phone, Sparkles, Loader2 } from "lucide-react";
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
  listQuotes,
  getQuote,
  updateQuote,
  deleteQuote,
  replaceQuoteLineItems,
} from "@/lib/bookings.functions";
import { sendQuoteToCustomer } from "@/lib/quote-email.functions";
import { draftQuoteForQuote } from "@/lib/ai-quote.functions";
import { BriefCapture } from "@/components/quotes/BriefCapture";


export const Route = createFileRoute("/_authenticated/bookings/quotes")({
  head: () => ({ meta: [{ title: "Quotes — Atyvia" }] }),
  component: QuotesPage,
});

type Quote = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  address: string | null;
  subtotal: number;
  vat_rate: number;
  total: number;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  responded_by: string | null;
  notes: string | null;
  phone?: string | null;

  created_at: string;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  awaiting_quote: { label: "Ready to quote", className: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
  draft: { label: "Draft", className: "border-muted-foreground/40 bg-muted/40 text-muted-foreground" },
  sent: { label: "Sent", className: "border-primary/40 bg-primary/10 text-primary" },
  accepted: { label: "Accepted", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  declined: { label: "Declined", className: "border-red-500/40 bg-red-500/10 text-red-500" },
  expired: { label: "Expired", className: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
};


const fmt = (n: number) => `£${Number(n).toFixed(2)}`;

function QuotesPage() {
  const { selectedSiteId } = useSelectedSite();
  const queryClient = useQueryClient();
  const fetchQuotes = useServerFn(listQuotes);
  const [openId, setOpenId] = useState<string | null>(null);
  const [briefFor, setBriefFor] = useState<Quote | null>(null);




  const { data, isLoading } = useQuery({
    queryKey: ["quotes", selectedSiteId],
    queryFn: () => fetchQuotes({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 15_000,
  });
  const quotes = (data?.quotes ?? []) as Quote[];

  return (
    <GatedPage>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Bookings · Quotes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Priced quotes for site visits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add line items, send to the customer, and convert accepted quotes into jobs.
          </p>
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading quotes…</div>
          ) : quotes.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <h3 className="text-sm font-semibold">No quotes yet</h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Open a site visit and click "Create quote" once you've done the visit.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {quotes.map((q) => {
                const meta = STATUS_META[q.status] ?? STATUS_META.draft;
                return (
                  <div
                    key={q.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(q.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenId(q.id);
                      }
                    }}
                    className={`grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 text-left transition-colors focus:outline-none ${
                      q.status === "declined"
                        ? "border-l-4 border-l-red-500 bg-red-500/5 hover:bg-red-500/10 focus:bg-red-500/10"
                        : "hover:bg-muted/30 focus:bg-muted/40"
                    }`}

                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{q.customer_name || "Unnamed customer"}</span>
                        <Badge variant="outline" className={`gap-1 text-[10px] ${meta.className}`}>{meta.label}</Badge>
                      </div>
                      {q.address && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-foreground/80">
                          <MapPin className="h-3 w-3 shrink-0 text-secondary" />
                          <span className="truncate">{q.address}</span>
                        </div>
                      )}
                      {q.phone && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{q.phone}</span>
                        </div>
                      )}
                      {q.notes && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">{q.notes}</p>}
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Created {format(new Date(q.created_at), "PP")}
                      </div>

                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <div>
                        <div className="text-sm font-semibold">{fmt(q.total)}</div>
                        <div className="text-[10px] text-muted-foreground">incl. {q.vat_rate}% VAT</div>
                      </div>
                      {(q.status === "awaiting_quote" || (q.status === "draft" && Number(q.total) === 0)) && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBriefFor(q);
                          }}
                          className="h-7 gap-1 px-2 text-[11px]"
                        >
                          <Sparkles className="h-3 w-3" />
                          Draft quote
                        </Button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {briefFor && (
        <DraftQuoteDialog
          quote={briefFor}
          onClose={() => setBriefFor(null)}
          onDrafted={async (id) => {
            await queryClient.invalidateQueries({ queryKey: ["quotes", selectedSiteId] });
            await queryClient.invalidateQueries({ queryKey: ["quote", id] });
            setBriefFor(null);
            setOpenId(id);
          }}
        />
      )}

      {openId && <QuoteEditor id={openId} onClose={() => setOpenId(null)} onChanged={() => queryClient.invalidateQueries({ queryKey: ["quotes", selectedSiteId] })} />}

    </GatedPage>
  );
}

function DraftQuoteDialog({
  quote,
  onClose,
  onDrafted,
}: {
  quote: Quote;
  onClose: () => void;
  onDrafted: (id: string) => void | Promise<void>;
}) {
  const draftAi = useServerFn(draftQuoteForQuote);
  const [brief, setBrief] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [drafting, setDrafting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ items: number; total: number; summary: string | null } | null>(null);

  const run = async (opts?: { withBrief?: boolean }) => {
    setDrafting(true);
    setError(null);
    try {
      const res = await draftAi({
        data: {
          quoteId: quote.id,
          ...(opts?.withBrief ? { brief, images } : {}),
        },
      });
      setResult({ items: res.items, total: res.total, summary: res.summary });
      if (opts?.withBrief) toast.success("Re-priced with your extra detail.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't draft the quote.");
    } finally {
      setDrafting(false);
    }
  };

  // Draft straight away from the call + visit data already on file — the
  // tradesperson only adds what they saw on site.
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Draft quote — {quote.customer_name || "customer"}
          </DialogTitle>
          <DialogDescription>
            Priced automatically from the call and visit details on file, using your Business Info and past jobs. Add
            anything you spotted on site, then review.
          </DialogDescription>
        </DialogHeader>

        {drafting && !result ? (
          <div className="grid place-items-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Reading the call and visit notes, then pricing the job…
          </div>
        ) : error && !result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
            <BriefCapture
              brief={brief}
              onBriefChange={setBrief}
              images={images}
              onImagesChange={setImages}
              label="Add the job detail (dictate, type or attach photos)"
              disabled={drafting}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={drafting}>
                Cancel
              </Button>
              <Button className="gap-1" onClick={() => run({ withBrief: true })} disabled={drafting}>
                {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {drafting ? "Pricing the job…" : "Generate draft"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {result && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                {result.summary && (
                  <p>
                    <span className="font-medium text-foreground">Job: </span>
                    {result.summary}
                  </p>
                )}
                <p className="mt-1 font-medium text-foreground">
                  {result.items} line items · {fmt(result.total)} incl. VAT
                </p>
              </div>
            )}

            <BriefCapture
              brief={brief}
              onBriefChange={setBrief}
              images={images}
              onImagesChange={setImages}
              label="Anything else from the visit? (dictate, type or attach photos — optional)"
              placeholder="e.g. 'Isolation valves seized, needs two new ones, access is tight under the basin…'"
              rows={3}
              disabled={drafting}
            />

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={drafting}>
                Cancel
              </Button>
              <Button
                variant="outline"
                className="gap-1"
                onClick={() => run({ withBrief: true })}
                disabled={drafting || (!brief.trim() && !images.length)}
              >
                {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {drafting ? "Re-pricing…" : "Re-price with this detail"}
              </Button>
              <Button className="gap-1" onClick={() => onDrafted(quote.id)} disabled={drafting || !result}>
                Review quote
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

    </Dialog>
  );
}

type LineItem = { id?: string; description: string; quantity: number; unit_price: number };


export function QuoteEditor({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const fetchQuote = useServerFn(getQuote);
  const upd = useServerFn(updateQuote);
  const replaceItems = useServerFn(replaceQuoteLineItems);
  const del = useServerFn(deleteQuote);
  const sendEmail = useServerFn(sendQuoteToCustomer);
  const [emailInput, setEmailInput] = useState<string>("");

  const detail = useQuery({
    queryKey: ["quote", id],
    queryFn: () => fetchQuote({ data: { id } }),
  });

  const [items, setItems] = useState<LineItem[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (detail.data?.lineItems) {
      setItems(
        detail.data.lineItems.map((li) => ({
          id: li.id,
          description: li.description ?? "",
          quantity: Number(li.quantity),
          unit_price: Number(li.unit_price),
        })),
      );
      setDirty(false);
    }
  }, [detail.data?.lineItems]);

  const quote = detail.data?.quote as Quote | null | undefined;

  useEffect(() => {
    if (quote) setEmailInput(quote.customer_email ?? "");
  }, [quote?.id, quote?.customer_email]);

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const vatRate = Number(quote?.vat_rate ?? 20);
  const total = subtotal * (1 + vatRate / 100);

  const saveMut = useMutation({
    mutationFn: async () => {
      await replaceItems({ data: { quoteId: id, items } });
    },
    onSuccess: () => {
      toast.success("Quote saved");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: async (status: "draft" | "sent" | "accepted" | "declined" | "expired") => {
      await upd({ data: { id, status } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      onChanged();
    },
  });

  const vatMut = useMutation({
    mutationFn: async (vat: number) => {
      await upd({ data: { id, vat_rate: vat } });
      await replaceItems({ data: { quoteId: id, items } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quote", id] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Quote deleted");
      onChanged();
      onClose();
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      // Persist any unsaved line items first so the email reflects the latest quote.
      if (dirty) await replaceItems({ data: { quoteId: id, items } });
      // Auto-save the edited email address before sending.
      const trimmed = emailInput.trim();
      if (trimmed && trimmed !== (quote?.customer_email ?? "")) {
        await upd({ data: { id, customer_email: trimmed } });
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      return sendEmail({ data: { quoteId: id, email: trimmed || null, origin } });
    },
    onSuccess: (res) => {
      setDirty(false);
      toast.success(`Quote emailed to ${res.recipient}`);
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote?.customer_name || "Quote"}</DialogTitle>
          <DialogDescription>{quote?.address ?? ""}</DialogDescription>
        </DialogHeader>

        {!quote ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`gap-1 ${(STATUS_META[quote.status] ?? STATUS_META.draft).className}`}>
                {quote.status === "declined" && quote.responded_by === "customer"
                  ? "Declined by customer"
                  : quote.status === "accepted" && quote.responded_by === "customer"
                  ? "Accepted by customer"
                  : (STATUS_META[quote.status] ?? STATUS_META.draft).label}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {quote.status === "declined" && quote.declined_at
                  ? `Declined ${format(new Date(quote.declined_at), "PP")}`
                  : quote.sent_at
                  ? `Sent ${format(new Date(quote.sent_at), "PP")}`
                  : "Not sent yet"}
              </span>
            </div>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs">Line items</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
                    setDirty(true);
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add line
                </Button>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground">No line items yet — add one to build the quote.</p>
                )}
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_80px_100px_100px_36px] items-center gap-2">
                    <Input
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) => {
                        const v = e.target.value;
                        setItems((prev) => prev.map((p, idx) => (idx === i ? { ...p, description: v } : p)));
                        setDirty(true);
                      }}
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={it.quantity}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setItems((prev) => prev.map((p, idx) => (idx === i ? { ...p, quantity: isNaN(v) ? 0 : v } : p)));
                        setDirty(true);
                      }}
                    />
                    <PriceInput
                      value={it.unit_price}
                      onChange={(v) => {
                        setItems((prev) => prev.map((p, idx) => (idx === i ? { ...p, unit_price: v } : p)));
                        setDirty(true);
                      }}
                    />
                    <div className="text-right text-sm font-medium">{fmt(it.quantity * it.unit_price)}</div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setItems((prev) => prev.filter((_, idx) => idx !== i));
                        setDirty(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            <section className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1.5">
                <Label className="text-xs">VAT rate (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  defaultValue={quote.vat_rate}
                  onBlur={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (!isNaN(v) && v !== Number(quote.vat_rate)) vatMut.mutate(v);
                  }}
                />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-right">
                <div className="text-xs text-muted-foreground">Subtotal · {fmt(subtotal)}</div>
                <div className="text-xs text-muted-foreground">VAT ({vatRate}%) · {fmt(subtotal * vatRate / 100)}</div>
                <div className="mt-1 text-lg font-semibold">{fmt(total)}</div>
              </div>
            </section>

            <div>
              <Label className="mb-1.5 block text-xs">Notes / terms</Label>
              <Textarea
                defaultValue={quote.notes ?? ""}
                rows={3}
                onBlur={(e) => {
                  const v = e.currentTarget.value;
                  if (v !== (quote.notes ?? "")) upd({ data: { id, notes: v || null } }).then(() => queryClient.invalidateQueries({ queryKey: ["quote", id] }));
                }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer name</Label>
                <Input
                  defaultValue={quote.customer_name ?? ""}
                  placeholder="Name"
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v !== (quote.customer_name ?? ""))
                      upd({ data: { id, customer_name: v || null } }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["quote", id] });
                        onChanged();
                      });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  defaultValue={quote.phone ?? ""}
                  placeholder="Customer phone"
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v !== (quote.phone ?? ""))
                      upd({ data: { id, phone: v || null } }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["quote", id] });
                        onChanged();
                      });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input
                  defaultValue={quote.address ?? ""}
                  placeholder="Job address"
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v !== (quote.address ?? ""))
                      upd({ data: { id, address: v || null } }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["quote", id] });
                        onChanged();
                      });
                  }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Changing the name, phone or address here updates the same customer everywhere — calls log, calendar, jobs and invoices.
            </p>


            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
              <Label className="text-xs">Send to customer by email</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="min-w-[220px] flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => sendMut.mutate()}
                  disabled={sendMut.isPending || !emailInput.trim()}
                >
                  <Send className="mr-1 h-3.5 w-3.5" />
                  {sendMut.isPending
                    ? "Sending…"
                    : quote.status === "sent" || quote.status === "declined"
                    ? "Resend"
                    : "Send"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Customer gets accept/decline buttons in the email. Their response updates the status here automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !dirty}>
                  Save changes
                </Button>
                {(quote.status === "sent" || quote.status === "declined") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMut.mutate("accepted")}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    {quote.status === "declined" ? "Override → Accept" : "Mark accepted"}
                  </Button>
                )}
                {quote.status === "sent" && (
                  <Button size="sm" variant="outline" onClick={() => statusMut.mutate("declined")}>
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Mark declined
                  </Button>
                )}
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMut.mutate()}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string>(value ? value.toFixed(2) : "0.00");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value ? value.toFixed(2) : "0.00");
  }, [value, focused]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        setFocused(true);
        if (text === "0.00" || text === "0") {
          setText("");
        } else {
          // select all so typing replaces
          e.currentTarget.select();
        }
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        setText(raw);
        const n = Number(raw);
        onChange(isNaN(n) ? 0 : n);
      }}
      onBlur={() => {
        setFocused(false);
        const n = Number(text);
        if (!text || isNaN(n)) {
          setText("0.00");
          onChange(0);
        } else {
          setText(n.toFixed(2));
          onChange(n);
        }
      }}
    />
  );
}
