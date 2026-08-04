import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  Mic, Square, Loader2, ImagePlus, X, Wand2, Plus, Trash2, Send, Save, Settings2, Hammer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { createQuoteFromDraft, type DraftQuoteLine } from "@/lib/ai-quote.functions";
import { sendQuoteToCustomer } from "@/lib/quote-email.functions";
import { getQuoteSettings, type QuoteSettings } from "@/lib/quote-settings.functions";
import {
  draftQuoteFromBrief,
  transcribeBrief,
  DEFAULT_PRICING,
  type PricingSettings,
} from "@/lib/quote-copilot.functions";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 2 });




const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that image."));
    r.readAsDataURL(file);
  });

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the recording."));
    r.readAsDataURL(blob);
  });

export function QuoteCopilotWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <CopilotPanel onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Quote Assist"
        title="Quote Assist"
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <Hammer className="h-6 w-6" />}
      </button>
    </>
  );
}

type Step = "brief" | "review";

function CopilotPanel({ onClose }: { onClose: () => void }) {
  const { selectedSiteId } = useSelectedSite();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draftFn = useServerFn(draftQuoteFromBrief);
  const transcribeFn = useServerFn(transcribeBrief);
  const createFn = useServerFn(createQuoteFromDraft);
  const sendFn = useServerFn(sendQuoteToCustomer);

  const [step, setStep] = useState<Step>("brief");
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [brief, setBrief] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [items, setItems] = useState<DraftQuoteLine[]>([]);
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const settingsFn = useServerFn(getQuoteSettings);
  const { data: settingsData } = useQuery({
    queryKey: ["quote-settings", selectedSiteId],
    queryFn: () => settingsFn({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    // Always pick up the latest Business Info the moment the widget opens.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const settings = settingsData?.settings ?? null;

  useEffect(() => {
    if (!settings) return;
    setPricing({
      labour_rate: Number(settings.labour_rate) || DEFAULT_PRICING.labour_rate,
      markup_pct: Number(settings.markup_pct) || 0,
      callout_fee: Number(settings.callout_fee) || 0,
      vat_rate: settings.vat_registered ? Number(settings.vat_rate) || 0 : 0,
    });
  }, [settings]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 2048) {
          toast.error("That recording was empty — try again.");
          return;
        }
        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const { text } = await transcribeFn({ data: { audioBase64: base64, mimeType: mime } });
          if (text) setBrief((prev) => (prev ? `${prev} ${text}` : text));
          else toast.error("Couldn't hear anything — try again.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to dictate.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, 6 - images.length);
    try {
      const urls = await Promise.all(picked.map(fileToDataUrl));
      setImages((prev) => [...prev, ...urls].slice(0, 6));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add that photo.");
    }
  };

  const generate = async () => {
    setDrafting(true);
    try {
      const res = await draftFn({
        data: { brief, images, siteId: selectedSiteId },
      });
      const draft = res.draft;
      if (res.pricing) setPricing(res.pricing);
      setSources(res.sources ?? []);
      setName(draft.customer_name ?? "");
      setEmail(draft.customer_email ?? "");
      setAddress(draft.address ?? "");
      setNotes(draft.notes ?? "");
      setSummary(draft.summary);
      setItems(
        draft.line_items.length ? draft.line_items : [{ description: "", quantity: 1, unit_price: 0 }],
      );
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft a quote.");
    } finally {
      setDrafting(false);
    }
  };


  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const vat = subtotal * (pricing.vat_rate / 100);
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
    if (send && !email.trim()) {
      toast.error("Add a customer email to send the quote.");
      return;
    }
    setSaving(true);
    try {
      const { id } = await createFn({
        data: {
          siteId: selectedSiteId,
          customer_name: name.trim() || null,
          customer_email: email.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          vat_rate: pricing.vat_rate,
          items: clean,
        },
      });
      if (send) {
        await sendFn({ data: { quoteId: id, email: email.trim(), origin: window.location.origin } });
        toast.success(`Quote sent to ${email.trim()}`);
      } else {
        toast.success("Draft quote saved");
      }
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onClose();
      navigate({ to: "/bookings/quotes" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 flex max-h-[76vh] w-[min(30rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wand2 className="h-4 w-4 text-primary" /> Quote Assist
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {step === "brief" ? "Describe the job, add photos — I'll price it up." : "Review, amend, then send."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Business info"
            onClick={() => {
              onClose();
              navigate({ to: "/business-info" });
            }}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>


      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {step === "brief" ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs">What's the job?</Label>
              <Textarea
                rows={5}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Tap the mic and talk it through — e.g. 'Replace a leaking basin mixer tap in a first-floor bathroom, isolation valves are seized…'"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={recording ? "destructive" : "outline"}
                  className="gap-1"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={transcribing}
                >
                  {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {recording ? "Stop" : "Dictate"}
                </Button>
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addPhotos(e.target.files)}
                  />
                  <span className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-input px-3 text-xs font-medium hover:bg-accent">
                    <ImagePlus className="h-3.5 w-3.5" /> Photos
                  </span>
                </label>
                {transcribing && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Transcribing…
                  </span>
                )}
                {recording && <Badge variant="destructive" className="animate-pulse">Recording</Badge>}
              </div>
            </div>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt={`Job photo ${i + 1}`} className="h-16 w-16 rounded-md object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Parts are searched live at {settings?.preferred_merchants || "Screwfix, Toolstation, Wickes"} and
              priced with your {pricing.markup_pct}% mark-up and £{pricing.labour_rate}/hr labour from Business
              Info. Always check prices before sending.
            </p>

            <Button className="w-full gap-2" onClick={generate} disabled={drafting || recording}>
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {drafting ? "Searching parts & pricing…" : "Generate draft quote"}
            </Button>
          </>
        ) : (
          <>
            {summary && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Job: </span>
                {summary}
              </div>
            )}
            {sources.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px]">
                <p className="mb-1 font-medium">Live parts pricing used</p>
                <ul className="space-y-0.5">
                  {sources.slice(0, 5).map((s, i) => (
                    <li key={i} className="truncate">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@email.com" type="email" />
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Job address" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Line items</Label>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_56px_76px_auto] items-center gap-1.5">
                  <Input value={it.description} onChange={(e) => patch(i, { description: e.target.value })} placeholder="Description" />
                  <Input type="number" min={0} step="0.25" value={it.quantity} onChange={(e) => patch(i, { quantity: Number(e.target.value) })} />
                  <Input type="number" min={0} step="0.01" value={it.unit_price} onChange={(e) => patch(i, { unit_price: Number(e.target.value) })} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unit_price: 0 }])}
              >
                <Plus className="h-3 w-3" /> Add line
              </Button>
            </div>

            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes to customer" />

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <Row label="Subtotal" value={money(subtotal)} />
              <Row label={`VAT (${pricing.vat_rate}%)`} value={money(vat)} />
              <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2 font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {step === "review" && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/30 p-3">
          <Button variant="ghost" size="sm" onClick={() => setStep("brief")} disabled={saving}>
            Back
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => approve(false)} disabled={saving}>
            <Save className="h-4 w-4" /> Save draft
          </Button>
          <Button size="sm" className="gap-1" onClick={() => approve(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to customer
          </Button>
        </div>
      )}
    </div>
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
