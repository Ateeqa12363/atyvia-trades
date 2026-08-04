import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Hammer, User, MapPin, Phone, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { GatedPage } from "@/components/GatedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { listJobs, updateJob, deleteJob, suggestJobContact } from "@/lib/bookings.functions";

export const Route = createFileRoute("/_authenticated/bookings/jobs")({
  head: () => ({ meta: [{ title: "Jobs — Atyvia" }] }),
  component: JobsPage,
});

type JobStatus = "booked" | "in_progress" | "completed" | "invoiced" | "cancelled";
type Job = {
  id: string;
  customer_name: string | null;
  address: string | null;
  phone: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  assigned_to: string | null;
  price: number;
  status: JobStatus;
  notes: string | null;
  duration_minutes: number | null;
};

const COLUMNS: { key: JobStatus; label: string; className: string }[] = [
  { key: "booked", label: "Booked", className: "border-primary/30" },
  { key: "completed", label: "Completed", className: "border-emerald-500/30" },
  { key: "cancelled", label: "Cancelled", className: "border-destructive/30" },
];


const fmt = (n: number) => `£${Number(n).toFixed(2)}`;

/** "Tue 4 Aug, 09:00–13:00" (or spanning days for a big job). */
function scheduleLabel(j: Job): string {
  if (!j.scheduled_date) return "";
  const day = format(new Date(`${j.scheduled_date}T00:00:00`), "EEE d MMM");
  const time = j.scheduled_time?.slice(0, 5);
  if (!time) return day;
  if (!j.duration_minutes) return `${day}, ${time}`;
  const end = new Date(`${j.scheduled_date}T${time}:00`);
  end.setMinutes(end.getMinutes() + j.duration_minutes);
  const sameDay = format(end, "yyyy-MM-dd") === j.scheduled_date;
  return sameDay
    ? `${day}, ${time}–${format(end, "HH:mm")}`
    : `${day}, ${time} → ${format(end, "EEE d MMM, HH:mm")}`;
}

function JobsPage() {
  const { selectedSiteId } = useSelectedSite();
  const queryClient = useQueryClient();
  const fetchJobs = useServerFn(listJobs);
  const upd = useServerFn(updateJob);
  const del = useServerFn(deleteJob);
  const [openId, setOpenId] = useState<string | null>(null);


  const { data, isLoading } = useQuery({
    queryKey: ["jobs", selectedSiteId],
    queryFn: () => fetchJobs({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });
  const jobs = (data?.jobs ?? []) as Job[];
  const activeJob = jobs.find((j) => j.id === openId) ?? null;

  const updateMut = useMutation({
    mutationFn: (patch: Parameters<typeof upd>[0]["data"]) => upd({ data: patch }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", selectedSiteId] });
      const keys = Object.keys(vars).filter((k) => k !== "id");
      if (keys.length > 1) {
        setOpenId(null);
        toast.success("Job saved · Cal.com updated");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      setOpenId(null);
      toast.success("Job deleted");
      queryClient.invalidateQueries({ queryKey: ["jobs", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", selectedSiteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <GatedPage>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Bookings · Jobs</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Booked jobs</h1>
        </div>

        {isLoading ? (
          <div className="glass-card rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Hammer className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <h3 className="text-sm font-semibold">No jobs yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Accept a quote and click "Create job" to book the work in.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {COLUMNS.map((col) => {
              const colJobs = jobs.filter((j) => j.status === col.key);
              const isDone = col.key === "completed";
              const isCancelled = col.key === "cancelled";

              return (
                <div key={col.key} className={`glass-card rounded-2xl border-t-2 ${col.className}`}>
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</div>
                    <Badge variant="outline" className="text-[10px]">{colJobs.length}</Badge>
                  </div>
                  <div className="space-y-2 p-2">
                    {colJobs.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-[11px] text-muted-foreground">
                        Nothing here yet
                      </div>
                    )}
                    {colJobs.map((j) => (
                      <div
                        key={j.id}
                        className={`w-full rounded-lg border p-3 text-xs shadow-sm transition-colors ${
                          isDone
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-border/60 bg-background/60 hover:bg-muted/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenId(j.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{j.customer_name || "Job"}</div>
                              {j.address && (
                                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{j.address}</span>
                                </div>
                              )}
                            </div>
                            <div className={`shrink-0 text-right text-sm font-semibold ${isDone ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{fmt(j.price)}</div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                          {j.scheduled_date && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {scheduleLabel(j)}
                            </span>
                          )}

                            {j.phone && (
                              <a
                                href={`tel:${j.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 hover:text-foreground"
                              >
                                <Phone className="h-3 w-3" />{j.phone}
                              </a>
                            )}
                            {j.assigned_to && (
                              <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{j.assigned_to}</span>
                            )}
                          </div>
                        </button>
                        <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                          {isCancelled ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px] text-muted-foreground"
                              onClick={() => updateMut.mutate({ id: j.id, status: "booked" })}
                            >
                              Restore
                            </Button>
                          ) : isDone ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px] text-muted-foreground"
                              onClick={() => updateMut.mutate({ id: j.id, status: "booked" })}
                            >
                              Reopen
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] text-muted-foreground"
                                onClick={() => updateMut.mutate({ id: j.id, status: "cancelled" })}
                              >
                                Cancel job
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                                onClick={() => updateMut.mutate({ id: j.id, status: "completed" })}
                              >
                                Mark complete
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Delete job"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this job permanently? Any calendar booking and draft invoice will be removed too.")) {
                                deleteMut.mutate(j.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <JobDialog
        job={activeJob}
        onClose={() => setOpenId(null)}
        onSave={(patch) => updateMut.mutate(patch)}
        saving={updateMut.isPending}
      />
    </GatedPage>
  );
}

type JobFormState = {
  customer_name: string;
  assigned_to: string;
  address: string;
  phone: string;
  scheduled_date: string;
  scheduled_time: string;
  end_date: string;
  end_time: string;
  price: string;
  status: JobStatus;
  notes: string;
};

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});

const durationLabel = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

/** Work out the end date/time from the stored start + duration. */
function toForm(j: Job): JobFormState {
  const startDate = j.scheduled_date ?? "";
  const startTime = j.scheduled_time?.slice(0, 5) ?? "";
  let endDate = "";
  let endTime = "";
  if (startDate && startTime && j.duration_minutes) {
    const end = new Date(`${startDate}T${startTime}:00`);
    end.setMinutes(end.getMinutes() + j.duration_minutes);
    endDate = format(end, "yyyy-MM-dd");
    endTime = format(end, "HH:mm");
  }
  return {
    customer_name: j.customer_name ?? "",
    assigned_to: j.assigned_to ?? "",
    address: j.address ?? "",
    phone: j.phone ?? "",
    scheduled_date: startDate,
    scheduled_time: startTime,
    end_date: endDate,
    end_time: endTime,
    price: String(j.price ?? 0),
    status: j.status,
    notes: j.notes ?? "",
  };
}

function JobDialog({
  job,
  onClose,
  onSave,
  saving,
}: {
  job: Job | null;
  onClose: () => void;
  onSave: (patch: {
    id: string;
    customer_name: string | null;
    assigned_to: string | null;
    address: string | null;
    phone: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    duration_minutes: number | null;
    price: number;
    status: JobStatus;
    notes: string | null;
  }) => void;
  saving: boolean;
}) {
  const { selectedSiteId } = useSelectedSite();
  const suggest = useServerFn(suggestJobContact);
  const [form, setForm] = useState<JobFormState | null>(null);
  const [filled, setFilled] = useState<string | null>(null);

  useEffect(() => {
    setForm(job ? toForm(job) : null);
    setFilled(null);
  }, [job?.id]);

  const { data: suggestion } = useQuery({
    queryKey: ["job-contact", job?.id, job?.customer_name],
    queryFn: () => suggest({ data: { siteId: selectedSiteId, jobId: job!.id, name: job!.customer_name } }),
    enabled: !!job?.id && !!selectedSiteId,
    staleTime: 60_000,
  });

  // Auto-fill blanks from the calls log / linked visit so the tradesperson only
  // has to ring the customer for availability.
  useEffect(() => {
    if (!suggestion || !form) return;
    const patch: Partial<JobFormState> = {};
    if (!form.phone.trim() && suggestion.phone) patch.phone = suggestion.phone;
    if (!form.address.trim() && suggestion.address) patch.address = suggestion.address;
    if (Object.keys(patch).length === 0) return;
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setFilled(suggestion.source ?? "calls log");
  }, [suggestion, job?.id]);

  if (!job || !form) {
    return (
      <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl" />
      </Dialog>
    );
  }

  const set = <K extends keyof JobFormState>(k: K, v: JobFormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev));

  const startAt =
    form.scheduled_date && form.scheduled_time
      ? new Date(`${form.scheduled_date}T${form.scheduled_time}:00`)
      : null;
  const endAt =
    form.end_date && form.end_time ? new Date(`${form.end_date}T${form.end_time}:00`) : null;
  const durationMins =
    startAt && endAt ? Math.round((endAt.getTime() - startAt.getTime()) / 60000) : null;
  const durationInvalid = durationMins !== null && durationMins <= 0;

  const handleSave = () => {
    if (durationInvalid) {
      toast.error("The job's finish time must be after its start time.");
      return;
    }
    const priceNum = Number(form.price);
    onSave({
      id: job.id,
      customer_name: form.customer_name.trim() || null,
      assigned_to: form.assigned_to.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      scheduled_date: form.scheduled_date || null,
      scheduled_time: form.scheduled_time || null,
      duration_minutes: durationMins,
      price: isNaN(priceNum) ? 0 : priceNum,
      status: form.status,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.customer_name || "Job"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {filled && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary">
              Customer details filled in automatically from the {filled}.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Customer</Label>
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.currentTarget.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Assigned to</Label>
              <Input value={form.assigned_to} placeholder="Team member name" onChange={(e) => set("assigned_to", e.currentTarget.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.currentTarget.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Phone</Label>
            <Input type="tel" value={form.phone} placeholder="Customer phone" onChange={(e) => set("phone", e.currentTarget.value)} />
            {suggestion?.phone && suggestion.phone !== form.phone && (
              <button
                type="button"
                onClick={() => {
                  set("phone", suggestion.phone!);
                  if (!form.address.trim() && suggestion.address) set("address", suggestion.address);
                  setFilled(suggestion.source ?? "calls log");
                }}
                className="mt-1 text-[11px] font-medium text-primary underline"
              >
                Use {suggestion.phone} from the {suggestion.source ?? "calls log"}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs font-semibold">Scheduled</Label>
              {durationMins !== null && !durationInvalid && (
                <span className="text-[11px] text-muted-foreground">{durationLabel(durationMins)}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-[11px] text-muted-foreground">Start date</Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    set("scheduled_date", v);
                    if (!form.end_date || form.end_date < v) set("end_date", v);
                  }}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-[11px] text-muted-foreground">Start time</Label>
                <Select
                  value={form.scheduled_time || "__none__"}
                  onValueChange={(v) => set("scheduled_time", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="__none__">No time</SelectItem>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-[11px] text-muted-foreground">End date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  min={form.scheduled_date || undefined}
                  onChange={(e) => set("end_date", e.currentTarget.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-[11px] text-muted-foreground">End time</Label>
                <Select
                  value={form.end_time || "__none__"}
                  onValueChange={(v) => set("end_time", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="__none__">No time</SelectItem>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {durationInvalid ? (
              <p className="mt-2 text-[11px] font-medium text-destructive">
                The finish must be after the start — for multi-day jobs set a later end date.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Saving books this straight into your calendar for the whole length of the job.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Price (£)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.currentTarget.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as JobStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Notes</Label>
            <Textarea value={form.notes} rows={3} onChange={(e) => set("notes", e.currentTarget.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || durationInvalid}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


