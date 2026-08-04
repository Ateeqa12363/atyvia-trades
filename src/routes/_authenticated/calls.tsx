import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PhoneCall, PhoneIncoming, PhoneOutgoing, CalendarCheck2, PhoneForwarded, CheckCircle2, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GatedPage } from "@/components/GatedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AiQuoteCopilot } from "@/components/quotes/AiQuoteCopilot";
import { listCalls, syncCallsFromRetell, getCall, setCallCallbackCompleted } from "@/lib/calls.functions";


export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({ meta: [{ title: "Calls Log — Atyvia" }] }),
  component: CallsPage,
});

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

type TranscriptTurn = { role?: string; content?: string };

function parseTranscript(t: unknown): TranscriptTurn[] | null {
  if (!t) return null;
  if (typeof t === "string") {
    // Retell sometimes gives a plain string with "Agent: ..." / "User: ..." lines.
    const lines = t.split("\n").filter(Boolean);
    const turns: TranscriptTurn[] = [];
    for (const line of lines) {
      const m = line.match(/^\s*(agent|user|assistant|caller|customer)\s*:\s*(.*)$/i);
      if (m) turns.push({ role: m[1].toLowerCase(), content: m[2] });
      else if (turns.length) turns[turns.length - 1].content += " " + line.trim();
      else turns.push({ role: "agent", content: line });
    }
    return turns.length ? turns : [{ content: t }];
  }
  if (Array.isArray(t)) return t as TranscriptTurn[];
  return null;
}

function needsCallback(c: {
  booked_appointment?: boolean | null;
  summary?: string | null;
  status?: string | null;
  custom_data?: unknown;
}): boolean {
  const custom = (c.custom_data ?? {}) as Record<string, unknown>;
  const flagKeys = ["callback_requested", "needs_callback", "requires_callback", "call_back", "callback"];
  for (const k of flagKeys) {
    const v = custom[k];
    if (v === true || v === "true" || v === "yes") return true;
  }
  const text = `${c.summary ?? ""} ${String(custom.callback_reason ?? "")}`.toLowerCase();
  if (/\b(call\s*back|callback|ring\s*back|follow[-\s]?up call|return the call)\b/.test(text)) return true;
  // Missed / voicemail calls without a booked appointment usually need a callback.
  const status = (c.status ?? "").toLowerCase();
  if (!c.booked_appointment && /(voicemail|no[-_ ]?answer|missed|failed)/.test(status)) return true;
  return false;
}

function CallsPage() {
  const queryClient = useQueryClient();
  const fetchCalls = useServerFn(listCalls);
  const sync = useServerFn(syncCallsFromRetell);
  const fetchCall = useServerFn(getCall);
  const markCallback = useServerFn(setCallCallbackCompleted);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [copilotCallId, setCopilotCallId] = useState<string | null>(null);


  const toggleCallback = async (
    e: React.MouseEvent,
    id: string,
    next: boolean,
  ) => {
    e.stopPropagation();
    setPendingId(id);
    try {
      await markCallback({ data: { id, completed: next } });
      await queryClient.invalidateQueries({ queryKey: ["calls"] });
      await queryClient.invalidateQueries({ queryKey: ["call", id] });
    } finally {
      setPendingId(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: () => fetchCalls(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const detail = useQuery({
    queryKey: ["call", openId],
    queryFn: () => fetchCall({ data: { id: openId! } }),
    enabled: !!openId,
  });

  // Silent background sync from Retell — runs on mount and every 60s so new calls
  // appear automatically even if webhooks aren't wired.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await sync();
        if (!cancelled) queryClient.invalidateQueries({ queryKey: ["calls"] });
      } catch {
        /* ignore — webhook path may still be delivering data */
      }
    };
    run();
    const id = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sync, queryClient]);

  const calls = data?.calls ?? [];
  const activeCall = detail.data?.call ?? null;
  const turns = activeCall ? parseTranscript(activeCall.transcript) : null;

  // Group calls by day (using start_time; fall back to "Unknown date").
  const allGroups: { key: string; label: string; isToday: boolean; items: typeof calls }[] = [];
  {
    const byKey = new Map<string, { label: string; isToday: boolean; items: typeof calls }>();
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    for (const c of calls) {
      let key = "unknown";
      let label = "Unknown date";
      let isToday = false;
      if (c.start_time) {
        const d = new Date(c.start_time);
        key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (sameDay(d, today)) { label = "Today"; isToday = true; }
        else if (sameDay(d, yesterday)) label = "Yesterday";
        else
          label = d.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
          });
      }
      if (!byKey.has(key)) {
        const g = { label, isToday, items: [] as typeof calls };
        byKey.set(key, g);
        allGroups.push({ key, label, isToday, items: g.items });
      }
      byKey.get(key)!.items.push(c);
    }
  }
  const todayGroups = allGroups.filter((g) => g.isToday);
  const pastGroups = allGroups.filter((g) => !g.isToday);
  const pastCount = pastGroups.reduce((n, g) => n + g.items.length, 0);
  const visibleGroups = showPast ? [...todayGroups, ...pastGroups] : todayGroups;

  return (
    <GatedPage>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Calls Log</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Every call, in one place</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live feed from your Voice Agent — updates automatically as new calls come in.
          </p>
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading calls…</div>
          ) : calls.length === 0 ? (
            <div className="p-12 text-center">
              <PhoneCall className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <h3 className="text-sm font-semibold">No calls yet</h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Once your AI agent is set up with the webhook URL below, every call will appear here automatically.
              </p>
              <div className="mx-auto mt-4 inline-block rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-left text-[11px] font-mono text-muted-foreground">
                Webhook URL: <span className="text-foreground">{typeof window !== "undefined" ? `${window.location.origin}/api/public/retell-webhook` : "/api/public/retell-webhook"}</span>
              </div>
            </div>
          ) : (
            <div>
              {todayGroups.length === 0 && !showPast && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No calls today.
                </div>
              )}
              {pastCount > 0 && (
                <div className="flex justify-center border-b border-border/60 px-4 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPast((v) => !v)}
                    className="rounded-full text-xs"
                  >
                    {showPast ? "Hide past" : `Show past (${pastCount})`}
                  </Button>
                </div>
              )}
              {visibleGroups.map((g) => (

                <div key={g.key}>
                  <div className="sticky top-0 z-10 border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {g.label}
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        {g.items.length} call{g.items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-border/60">
                    {g.items.map((c) => {
                      const DirIcon = c.direction === "outbound" ? PhoneOutgoing : PhoneIncoming;
                      const needs = needsCallback(c);
                      const done = Boolean(c.callback_completed);
                      const showCallback = needs || done;
                      const rowClass = done
                        ? "border-l-2 border-emerald-500 bg-emerald-500/[0.06] hover:bg-emerald-500/10 focus:bg-emerald-500/15"
                        : needs
                        ? "border-l-2 border-amber-500 bg-amber-500/[0.06] hover:bg-amber-500/10 focus:bg-amber-500/15"
                        : "hover:bg-muted/30 focus:bg-muted/40";
                      const iconClass = done
                        ? "bg-emerald-500/15 text-emerald-500"
                        : needs
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-primary/10 text-primary";
                      return (
                        <div
                          key={c.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setOpenId(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOpenId(c.id);
                            }
                          }}
                          className={`grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 p-4 text-left transition-colors focus:outline-none ${rowClass}`}
                        >
                          <div className={`grid h-10 w-10 place-items-center rounded-lg ${iconClass}`}>
                            <DirIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{c.caller_name || c.from_number || "Unknown caller"}</span>
                              {c.from_number && c.caller_name && (
                                <span className="text-xs font-medium text-muted-foreground">{c.from_number}</span>
                              )}

                              {c.booked_appointment && (
                                <Badge variant="outline" className="gap-1 border-secondary/40 bg-secondary/10 text-[10px] text-secondary">
                                  <CalendarCheck2 className="h-3 w-3" /> Job booked
                                </Badge>
                              )}
                              {done ? (
                                <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-500">
                                  <CheckCircle2 className="h-3 w-3" /> Called back
                                </Badge>
                              ) : needs ? (
                                <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-500">
                                  <PhoneForwarded className="h-3 w-3" /> Needs callback
                                </Badge>
                              ) : null}
                            </div>
                            {c.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.summary}</p>}
                            <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                              <span>{c.from_number ?? "—"}</span>
                              <span>·</span>
                              <span>{fmtDuration(c.duration_seconds)}</span>
                              {c.appointment_time && (
                                <>
                                  <span>·</span>
                                  <span>Booked for {new Date(c.appointment_time).toLocaleString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-[11px] text-muted-foreground">
                              {c.start_time
                                ? new Date(c.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                                : "—"}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCopilotCallId(c.id);
                              }}
                              className="h-7 gap-1 border-primary/40 bg-primary/10 px-2 text-[11px] text-primary hover:bg-primary/20"
                            >
                              <Sparkles className="h-3 w-3" /> Draft quote
                            </Button>

                            {showCallback && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pendingId === c.id}
                                onClick={(e) => toggleCallback(e, c.id, !done)}
                                className={
                                  done
                                    ? "h-7 gap-1 border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-500 hover:bg-emerald-500/20"
                                    : "h-7 gap-1 border-amber-500/40 bg-amber-500/10 px-2 text-[11px] text-amber-500 hover:bg-amber-500/20"
                                }
                              >
                                {done ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" /> Called back
                                  </>
                                ) : (
                                  <>
                                    <PhoneForwarded className="h-3 w-3" /> Mark called back
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeCall?.caller_name || activeCall?.from_number || "Call details"}
            </DialogTitle>
            <DialogDescription>
              {activeCall?.start_time
                ? new Date(activeCall.start_time).toLocaleString()
                : detail.isLoading ? "Loading…" : ""}
            </DialogDescription>
          </DialogHeader>

          {detail.isLoading && <p className="text-sm text-muted-foreground">Loading call…</p>}

          {activeCall && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">AI Copilot</span> — turn this call into a quote.
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={() => setCopilotCallId(activeCall.id)}
                >
                  <Sparkles className="h-3 w-3" /> Draft quote
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <Stat label="From" value={activeCall.from_number ?? "—"} />
                {activeCall.to_number && <Stat label="To" value={activeCall.to_number} />}
                <Stat label="Duration" value={fmtDuration(activeCall.duration_seconds)} />
                {activeCall.direction && <Stat label="Direction" value={activeCall.direction} />}
              </div>
              {(needsCallback(activeCall) || activeCall.callback_completed) && (
                <div
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
                    activeCall.callback_completed
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {activeCall.callback_completed ? <CheckCircle2 className="h-4 w-4" /> : <PhoneForwarded className="h-4 w-4" />}
                    <span>
                      {activeCall.callback_completed
                        ? `Called back${activeCall.callback_completed_at ? ` ${formatDistanceToNow(new Date(activeCall.callback_completed_at), { addSuffix: true })}` : ""}.`
                        : `Customer needs a callback${activeCall.from_number ? ` — ${activeCall.from_number}` : ""}.`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pendingId === activeCall.id}
                    onClick={(e) => toggleCallback(e, activeCall.id, !activeCall.callback_completed)}
                    className={
                      activeCall.callback_completed
                        ? "h-7 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                        : "h-7 border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                    }
                  >
                    {activeCall.callback_completed ? "Mark as not called back" : "Mark called back"}
                  </Button>
                </div>
              )}

              {activeCall.summary && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</h4>
                  <p className="text-sm leading-relaxed">{activeCall.summary}</p>
                </section>
              )}

              {activeCall.appointment_notes && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appointment notes</h4>
                  <p className="text-sm leading-relaxed">{activeCall.appointment_notes}</p>
                </section>
              )}

              {activeCall.recording_url && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recording</h4>
                  <audio src={activeCall.recording_url} controls className="w-full" />
                </section>
              )}

              <section>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transcript</h4>
                {turns && turns.length ? (
                  <div className="space-y-2">
                    {turns.map((t, i) => {
                      const isAgent = /agent|assistant/i.test(t.role ?? "");
                      return (
                        <div
                          key={i}
                          className={`rounded-lg px-3 py-2 text-sm ${
                            isAgent
                              ? "bg-primary/10 text-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isAgent ? "Agent" : t.role || "Caller"}
                          </div>
                          <div className="whitespace-pre-wrap">{t.content}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No transcript available.</p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AiQuoteCopilot
        callId={copilotCallId}
        open={!!copilotCallId}
        onOpenChange={(o) => !o && setCopilotCallId(null)}
      />
    </GatedPage>

  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm capitalize">{value}</div>
    </div>
  );
}
