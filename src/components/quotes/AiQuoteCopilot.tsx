import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, Loader2, Plus, Trash2, Send, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { draftQuoteFromCall, createQuoteFromDraft, type DraftQuoteLine } from "@/lib/ai-quote.functions";
import { sendQuoteToCustomer } from "@/lib/quote-email.functions";
import { draftQuoteFromBrief } from "@/lib/quote-copilot.functions";
import { BriefCapture } from "@/components/quotes/BriefCapture";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 2 });

export function AiQuoteCopilot({
  callId,
  open,
  onOpenChange,
}: {
  callId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedSiteId } = useSelectedSite();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draftFn = useServerFn(draftQuoteFromCall);
  const createFn = useServerFn(createQuoteFromDraft);
  const sendFn = useServerFn(sendQuoteToCustomer);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [items, setItems] = useState<DraftQuoteLine[]>([]);
  const [brief, setBrief] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [redrafting, setRedrafting] = useState(false);
  const briefDraftFn = useServerFn(draftQuoteFromBrief);

  const redraft = async () => {
    setRedrafting(true);
    try {
      const combined = [
        summary ? `Job from the phone call: ${summary}` : "",
        notes ? `Current notes: ${notes}` : "",
        brief.trim() ? `Extra detail from the tradesperson: ${brief.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const res = await briefDraftFn({ data: { brief: combined, images, siteId: selectedSiteId } });
      const d = res.draft;
      if (d.customer_name && !name) setName(d.customer_name);
      if (d.address && !address) setAddress(d.address);
      if (d.notes) setNotes(d.notes);
      if (d.summary) setSummary(d.summary);
      setItems(d.line_items.length ? d.line_items : items);
      toast.success("Re-priced with your extra detail — check the lines.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not re-price the quote.");
    } finally {
      setRedrafting(false);
    }
  };


  useEffect(() => {
    if (!open || !callId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);
    setSummary(null);
    draftFn({ data: { callId } })
      .then((res) => {
        if (cancelled) return;
        const d = res.draft;
        setName(d.customer_name ?? "");
        setEmail(d.customer_email ?? "");
        setPhone(d.phone ?? "");
        setAddress(d.address ?? "");

        setNotes(d.notes ?? "");
        setSummary(d.summary);
        setItems(d.line_items.length ? d.line_items : [{ description: "", quantity: 1, unit_price: 0 }]);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not draft a quote from this call.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, callId, draftFn]);

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  const patch = (i: number, p: Partial<DraftQuoteLine>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const approve = async (send: boolean) => {
    if (!selectedSiteId) {
      toast.error("No site selected.");
      return;
    }
    const clean = items.filter((it) => it.description.trim());
    if (!clean.length) {
      toast.error("Add at least one line item.");
      return;
    }
    setSaving(true);
    try {
      const { id } = await createFn({
        data: {
          siteId: selectedSiteId,
          customer_name: name.trim() || null,
          customer_email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,

          notes: notes.trim() || null,
          vat_rate: 20,
          items: clean,
        },
      });
      if (send) {
        if (!email.trim()) {
          toast.error("Add a customer email to send the quote.");
          setSaving(false);
          return;
        }
        await sendFn({
          data: { quoteId: id, email: email.trim(), origin: window.location.origin },
        });
        toast.success(`Quote sent to ${email.trim()}`);
      } else {
        toast.success("Draft quote saved");
      }
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onOpenChange(false);
      navigate({ to: "/bookings/quotes" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Copilot — draft quote
          </DialogTitle>
          <DialogDescription>
            Built from the call. Check the details and prices, then approve to send it to the customer.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid place-items-center gap-3 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Reading the call and pricing the job…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="space-y-5">
            {summary && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Job: </span>
                {summary}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@email.com"
                  type="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer phone" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Job address" />
              </div>

            </div>

            <div className="space-y-2">
              <Label className="text-xs">Line items</Label>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_72px_96px_auto] items-center gap-2">
                    <Input
                      value={it.description}
                      onChange={(e) => patch(i, { description: e.target.value })}
                      placeholder="Description"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={it.quantity}
                      onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) => patch(i, { unit_price: Number(e.target.value) })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }])}
              >
                <Plus className="h-3 w-3" /> Add line
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes to customer</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <BriefCapture
                brief={brief}
                onBriefChange={setBrief}
                images={images}
                onImagesChange={setImages}
                label="Add detail — dictate or attach photos, then re-price"
                placeholder="e.g. 'Also needs two isolation valves, access is tight under the basin…'"
                rows={3}
                disabled={redrafting}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-1"
                onClick={redraft}
                disabled={redrafting || (!brief.trim() && !images.length)}
              >
                {redrafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {redrafting ? "Searching parts & re-pricing…" : "Re-price with these details"}
              </Button>
            </div>


            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <Row label="Subtotal" value={money(subtotal)} />
              <Row label="VAT (20%)" value={money(vat)} />
              <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2 font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="outline" className="gap-1" onClick={() => approve(false)} disabled={saving}>
                <Save className="h-4 w-4" /> Save as draft
              </Button>
              <Button className="gap-1" onClick={() => approve(true)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Approve & send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
