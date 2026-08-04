import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  MapPin,
  Plus,

  Phone,
  Trash2,
  User,
} from "lucide-react";

import {
  format,
  isToday,
  isSameMonth,
  isSameDay,
  isPast,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { GatedPage } from "@/components/GatedPage";
import { listCalBookings, type CalBooking } from "@/lib/calendar.functions";
import { visitKind, isCancelledStatus, type VisitKind } from "@/lib/visit-kind";
import { completeVisitFromCalBooking, listCompletedVisitBookings } from "@/lib/bookings.functions";
import { rescheduleCalBooking, cancelCalBooking, createCalBooking } from "@/lib/cal-manage.functions";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";




export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Atyvia" },
      { name: "description", content: "Month view of your quote visits and job visits, synced from Cal.com." },
      { property: "og:title", content: "Calendar — Atyvia" },
      { property: "og:description", content: "Month view of your quote visits and job visits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const isCancelled = isCancelledStatus;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TIME_OPTIONS = Array.from({ length: 60 }, (_, i) => {
  const mins = 6 * 60 + i * 15; // 06:00 → 20:45
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

function CalendarPage() {
  const fetchBookings = useServerFn(listCalBookings);
  const completeVisitFn = useServerFn(completeVisitFromCalBooking);
  const fetchCompleted = useServerFn(listCompletedVisitBookings);
  const rescheduleFn = useServerFn(rescheduleCalBooking);
  const cancelFn = useServerFn(cancelCalBooking);
  const { selectedSiteId } = useSelectedSite();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cal-bookings"],
    queryFn: () => fetchBookings(),
    refetchInterval: 60_000,
  });

  const completed = useQuery({
    queryKey: ["completed-visit-bookings", selectedSiteId],
    queryFn: () => fetchCompleted({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
  });
  const completedIds = useMemo(
    () => new Set(completed.data?.bookingIds ?? []),
    [completed.data],
  );

  const completeVisit = async (b: CalBooking) => {
    if (!selectedSiteId) return;
    setCompletingId(b.id);
    try {
      const res = await completeVisitFn({
        data: {
          siteId: selectedSiteId,
          calBookingId: b.id,
          customer_name: b.attendeeName,
          customer_email: b.attendeeEmail,
          phone: b.attendeePhone,
          address: b.address ?? b.location ?? null,
          notes: b.notes,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["completed-visit-bookings", selectedSiteId] });
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Visit marked completed — it's ready to quote.", {
        action: { label: "Open quotes", onClick: () => navigate({ to: "/bookings/quotes" }) },
      });
      return res;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't mark the visit completed.");
    } finally {
      setCompletingId(null);
    }
  };

  const refreshCalendar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cal-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["site-visits"] });
  };

  /** Move a booking to a new day (keeping its time) and/or a new time. */
  const moveBooking = async (b: CalBooking, dayIso: string, time?: string) => {
    const keepTime = time ?? format(new Date(b.start), "HH:mm");
    setBusyId(b.id);
    try {
      await rescheduleFn({ data: { bookingUid: b.id, start: `${dayIso}T${keepTime}:00` } });
      await refreshCalendar();
      toast.success(`Moved to ${format(new Date(`${dayIso}T${keepTime}:00`), "EEE d MMM, HH:mm")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't move that booking.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteBooking = async (b: CalBooking) => {
    if (!confirm("Delete this calendar entry? The customer will be told it's cancelled.")) return;
    setBusyId(b.id);
    try {
      await cancelFn({ data: { bookingUid: b.id } });
      await refreshCalendar();
      toast.success("Entry deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete that booking.");
    } finally {
      setBusyId(null);
    }
  };


  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [showCancelled, setShowCancelled] = useState(false);

  const allBookings = data?.bookings ?? [];
  const configured = data?.configured ?? false;

  const bookings = useMemo(
    () => allBookings.filter((b) => showCancelled || !isCancelled(b.status)),
    [allBookings, showCancelled],
  );

  const byDay = useMemo(() => {
    const map: Record<string, CalBooking[]> = {};
    for (const b of bookings) {
      const key = format(new Date(b.start), "yyyy-MM-dd");
      (map[key] ??= []).push(b);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => +new Date(a.start) - +new Date(b.start));
    }
    return map;
  }, [bookings]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const cancelledCount = allBookings.filter((b) => isCancelled(b.status)).length;
  const monthCounts = useMemo(() => {
    let quote = 0;
    let job = 0;
    for (const b of bookings) {
      if (!isSameMonth(new Date(b.start), cursor)) continue;
      if (visitKind(b) === "job") job++;
      else quote++;
    }
    return { quote, job };
  }, [bookings, cursor]);

  const selectedKey = format(selected, "yyyy-MM-dd");
  const selectedBookings = byDay[selectedKey] ?? [];

  return (
    <GatedPage>
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Calendar</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your bookings</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous month"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              className="rounded-lg border border-border/60 p-2 hover:bg-muted/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[150px] text-center text-sm font-semibold">{format(cursor, "MMMM yyyy")}</div>
            <button
              aria-label="Next month"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="rounded-lg border border-border/60 p-2 hover:bg-muted/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setCursor(now);
                setSelected(now);
              }}
              className="ml-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
            >
              Today
            </button>
            <Button
              type="button"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="ml-1 h-8 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> New entry
            </Button>
          </div>

        </div>

        {!configured && !isLoading && (
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-sm font-semibold">Connect your Cal.com calendar</h3>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                1. Log in to{" "}
                <a
                  href="https://app.cal.com/settings/developer/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Cal.com → Settings → Developer → API Keys
                </a>
              </li>
              <li>2. Create a new API key (no expiry recommended)</li>
              <li>3. Paste it into the secret prompt — the calendar will start syncing automatically</li>
            </ol>
          </div>
        )}

        {error && (
          <div className="glass-card rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn't load bookings: {(error as Error).message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Quote visit ({monthCounts.quote})
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
            Job visit ({monthCounts.job})
          </span>
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className={`rounded-full border px-3 py-1 transition ${
              showCancelled
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {showCancelled ? "Hide" : "Show"} cancelled ({cancelledCount})
          </button>
        </div>

        {isLoading ? (
          <div className="glass-card rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading bookings…</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Month grid */}
            <div className="glass-card overflow-hidden rounded-2xl">
              <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]"
                  >
                    <span className="sm:hidden">{d[0]}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const items = byDay[key] ?? [];
                  const inMonth = isSameMonth(day, cursor);
                  const isSel = isSameDay(day, selected);
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(day)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelected(day);
                      }}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        setDragOverKey(key);
                      }}
                      onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain") || dragId;
                        setDragOverKey(null);
                        setDragId(null);
                        const booking = allBookings.find((x) => x.id === id);
                        if (!booking) return;
                        if (format(new Date(booking.start), "yyyy-MM-dd") === key) return;
                        setSelected(day);
                        void moveBooking(booking, key);
                      }}
                      className={`flex min-h-[76px] cursor-pointer flex-col gap-1 border-b border-r border-border/50 p-1 text-left transition sm:min-h-[128px] sm:p-2 ${
                        inMonth ? "" : "bg-muted/20"
                      } ${
                        dragOverKey === key
                          ? "bg-primary/10 ring-2 ring-inset ring-primary"
                          : isSel
                            ? "bg-primary/5 ring-2 ring-inset ring-primary/60"
                            : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex min-w-0 items-center justify-between gap-1">
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            isToday(day)
                              ? "bg-primary text-primary-foreground"
                              : inMonth
                                ? "text-foreground"
                                : "text-muted-foreground/50"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        {items.length > 0 && (
                          <span className="hidden shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:inline">
                            {items.length}
                          </span>
                        )}
                      </div>

                      {/* Mobile: coloured dots */}
                      <div className="flex flex-wrap gap-0.5 sm:hidden">
                        {items.slice(0, 4).map((b) => (
                          <span
                            key={b.id}
                            className={`h-1.5 w-1.5 rounded-full ${
                              visitKind(b) === "job" ? "bg-secondary" : "bg-primary"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Desktop: detailed chips — drag one onto another day to move it */}
                      <div className="hidden min-w-0 flex-1 space-y-1 sm:block">
                        {items.slice(0, 3).map((b) => {
                          const kind = visitKind(b);
                          const cancelled = isCancelled(b.status);
                          return (
                            <div
                              key={b.id}
                              draggable={!cancelled}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", b.id);
                                e.dataTransfer.effectAllowed = "move";
                                setDragId(b.id);
                              }}
                              onDragEnd={() => {
                                setDragId(null);
                                setDragOverKey(null);
                              }}
                              title={`${format(new Date(b.start), "HH:mm")}–${format(new Date(b.end), "HH:mm")} · ${
                                kind === "job" ? "Job visit" : "Quote visit"
                              }${b.attendeeName ? ` · ${b.attendeeName}` : ""}${b.address ? ` · ${b.address}` : ""} — drag to move`}
                              className={`group min-w-0 rounded-md border-l-[3px] px-1.5 py-1 ${
                                cancelled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                              } ${
                                kind === "job"
                                  ? "border-l-secondary bg-secondary/15"
                                  : "border-l-primary bg-primary/10"
                              } ${cancelled ? "opacity-60" : ""} ${
                                dragId === b.id || busyId === b.id ? "opacity-40" : ""
                              }`}
                            >
                              <div
                                className={`flex min-w-0 items-center gap-1 text-[10px] font-semibold leading-tight ${
                                  kind === "job" ? "text-secondary" : "text-primary"
                                } ${cancelled ? "line-through" : ""}`}
                              >
                                {!cancelled && (
                                  <GripVertical className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-60" />
                                )}
                                <span className="shrink-0">{format(new Date(b.start), "HH:mm")}</span>
                                <span className="truncate">{kind === "job" ? "Job" : "Quote"}</span>
                              </div>
                              {b.attendeeName && (
                                <div className="truncate text-[10px] leading-tight text-muted-foreground">
                                  {b.attendeeName}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {items.length > 3 && (
                          <div className="px-1 text-[10px] font-medium text-muted-foreground">
                            +{items.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );

                })}
              </div>
            </div>


            {/* Day detail */}
            <div className="glass-card rounded-2xl p-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">
                  {isToday(selected) ? "Today" : format(selected, "EEEE")}
                </h2>
                <span className="text-[11px] text-muted-foreground">{format(selected, "d MMM yyyy")}</span>
              </div>

              {selectedBookings.length === 0 ? (
                <div className="py-10 text-center">
                  <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">No bookings this day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedBookings.map((b) => {
                    const start = new Date(b.start);
                    const end = new Date(b.end);
                    const cancelled = isCancelled(b.status);
                    const past = isPast(end);
                    const kind = visitKind(b);
                    return (
                      <div
                        key={b.id}
                        className={`rounded-xl border-l-[6px] p-3 ${
                          kind === "job" ? "border-l-secondary bg-secondary/10" : "border-l-primary bg-primary/10"
                        } ${cancelled ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold ${cancelled ? "line-through" : ""}`}>
                            {kind === "job" ? "Job Visit" : "Quote Visit"}
                          </span>
                          <span className={`text-xs ${past ? "text-muted-foreground" : "font-medium"}`}>
                            {format(start, "HH:mm")}–{format(end, "HH:mm")}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                          {b.attendeeName && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3" />
                              {b.attendeeName}
                            </div>
                          )}
                          {b.attendeePhone && (
                            <a href={`tel:${b.attendeePhone}`} className="flex items-center gap-1.5 hover:text-foreground">
                              <Phone className="h-3 w-3" />
                              {b.attendeePhone}
                            </a>
                          )}
                          {b.address ? (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{b.address}</span>
                            </div>
                          ) : b.location && !/^https?:\/\//i.test(b.location) && !/cal\.com\/video/i.test(b.location) ? (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{b.location}</span>
                            </div>
                          ) : null}
                          {b.notes && <p className="line-clamp-3 text-muted-foreground/80">{b.notes}</p>}
                        </div>
                        {kind === "quote" && !cancelled && (
                          <div className="mt-2">
                            {completedIds.has(b.id) ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> Visit completed — ready to quote
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={completingId === b.id}
                                onClick={() => completeVisit(b)}
                                className="h-7 gap-1 px-2 text-[11px]"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {completingId === b.id ? "Saving…" : "Visit completed"}
                              </Button>
                            )}
                          </div>
                        )}

                        {!cancelled && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <Select
                                value={format(start, "HH:mm")}
                                disabled={busyId === b.id}
                                onValueChange={(t) =>
                                  moveBooking(b, format(start, "yyyy-MM-dd"), t)
                                }
                              >
                                <SelectTrigger className="h-7 w-[84px] text-[11px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {TIME_OPTIONS.map((t) => (
                                    <SelectItem key={t} value={t} className="text-xs">
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyId === b.id}
                              onClick={() => deleteBooking(b)}
                              className="h-7 gap-1 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                              {busyId === b.id ? "Working…" : "Delete"}
                            </Button>
                          </div>
                        )}
                      </div>

                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <AddEntryDialog
          day={selected}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            setAddOpen(false);
            await refreshCalendar();
          }}
        />
      )}
    </GatedPage>
  );
}

const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

function AddEntryDialog({
  day,
  onClose,
  onCreated,
}: {
  day: Date;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const createFn = useServerFn(createCalBooking);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kind: "quote" as VisitKind,
    date: format(day, "yyyy-MM-dd"),
    time: "09:00",
    durationMinutes: 60,
    customerName: "",
    customerEmail: "",
    phone: "",
    address: "",
    notes: "",
  });

  const submit = async () => {
    if (!form.customerName.trim()) {
      toast.error("Add a customer name for this entry.");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        data: {
          kind: form.kind,
          date: form.date,
          time: form.time,
          durationMinutes: form.durationMinutes,
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      toast.success("Entry added to your calendar");
      await onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add that entry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New calendar entry</DialogTitle>
          <DialogDescription>
            Add a visit by hand — it's created in your Cal.com calendar straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as VisitKind }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote">Quote visit</SelectItem>
                  <SelectItem value="job">Job visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration</Label>
              <Select
                value={String(form.durationMinutes)}
                onValueChange={(v) => setForm((f) => ({ ...f, durationMinutes: Number(v) }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d < 60 ? `${d} min` : `${d / 60} hr${d >= 120 ? "s" : ""}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.currentTarget.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start time</Label>
              <Select value={form.time} onValueChange={(v) => setForm((f) => ({ ...f, time: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Customer</Label>
              <Input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.currentTarget.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.currentTarget.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Customer email (optional)</Label>
              <Input
                type="email"
                value={form.customerEmail}
                placeholder="name@email.com"
                onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.currentTarget.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Job address & postcode</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.currentTarget.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.currentTarget.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy} className="gap-2">
              <Plus className="h-4 w-4" />
              {busy ? "Adding…" : "Add entry"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

