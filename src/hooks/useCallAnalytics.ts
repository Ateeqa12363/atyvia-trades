import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncCallsFromRetell } from "@/lib/calls.functions";
import { listCalBookings, type CalBooking } from "@/lib/calendar.functions";
import { listJobs } from "@/lib/bookings.functions";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { useDashboardMonth, MIN_YM, compareYM, type YearMonth } from "@/components/dashboard/DashboardMonthContext";

export type CallRow = {
  id: string;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
  status: string | null;
  disconnect_reason: string | null;
  direction: string | null;
  booked_appointment: boolean | null;
  appointment_time: string | null;
  from_number: string | null;
  caller_name: string | null;
  summary: string | null;
  custom_data: Record<string, unknown> | null;
};

type JobRow = {
  id: string;
  price: number | null;
  status: string | null;
  scheduled_date: string | null;
  created_at: string | null;
};

// Monthly cost of a receptionist (£).
const RECEPTIONIST_MONTHLY = 2200;
// Monthly cost of Atyvia (£).
const ATYVIA_MONTHLY = 577;
const RETELL_SYNC_INTERVAL_MS = 60_000;
let retellSyncInFlight: Promise<unknown> | null = null;
let lastRetellSyncAt = 0;

async function fetchAllCalls(siteId: string | null): Promise<CallRow[]> {
  if (!siteId) return [];
  // Pull last ~2 years so month-by-month navigation has history.
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const { data, error } = await supabase
    .from("calls")
    .select(
      "id,start_time,end_time,duration_seconds,status,disconnect_reason,direction,booked_appointment,appointment_time,from_number,caller_name,summary,custom_data",
    )
    .eq("site_id", siteId)
    .gte("start_time", cutoff.toISOString())
    .order("start_time", { ascending: false })
    .limit(10000);
  if (error) throw error;
  return (data ?? []) as CallRow[];
}

export function useRecentCalls() {
  const { selectedSiteId } = useSelectedSite();
  const queryClient = useQueryClient();
  const sync = useServerFn(syncCallsFromRetell);

  useEffect(() => {
    if (!selectedSiteId) return;
    let cancelled = false;

    const run = async () => {
      try {
        const now = Date.now();
        if (!retellSyncInFlight && now - lastRetellSyncAt >= RETELL_SYNC_INTERVAL_MS - 5_000) {
          lastRetellSyncAt = now;
          retellSyncInFlight = sync().finally(() => {
            retellSyncInFlight = null;
          });
        }
        if (!retellSyncInFlight) return;
        await retellSyncInFlight;
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ["calls"] });
        }
      } catch {
        /* Retell sync is best-effort; direct webhook/refetch path still works. */
      }
    };

    run();
    const id = window.setInterval(run, RETELL_SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedSiteId, sync, queryClient]);

  return useQuery({
    queryKey: ["calls", "by-site", selectedSiteId],
    queryFn: () => fetchAllCalls(selectedSiteId),
    enabled: selectedSiteId !== null,
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
}

function isAnswered(c: CallRow) {
  return (c.duration_seconds ?? 0) > 0;
}

const monthWindow = (year: number, month: number) => {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  return { start, end };
};

export function useAnalytics() {
  const q = useRecentCalls();
  const rows = q.data ?? [];
  const { selectedSiteId } = useSelectedSite();

  const fetchBookings = useServerFn(listCalBookings);
  const bq = useQuery({
    queryKey: ["cal-bookings"],
    queryFn: () => fetchBookings(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const allBookings: CalBooking[] = bq.data?.bookings ?? [];
  const activeBookings = allBookings.filter(
    (b) => (b.status ?? "").toLowerCase() !== "cancelled",
  );

  // Jobs — booked jobs (auto-created from accepted quotes) drive the
  // "Jobs Booked" KPI and the "Money Earned" figure (sum of quote values).
  const fetchJobs = useServerFn(listJobs);
  const jobsQ = useQuery({
    queryKey: ["jobs", selectedSiteId],
    queryFn: () => fetchJobs({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const allJobs: JobRow[] = (jobsQ.data?.jobs ?? []) as JobRow[];
  const activeJobs = allJobs.filter((j) => (j.status ?? "") !== "cancelled");
  const jobDate = (j: JobRow) => j.scheduled_date ?? j.created_at;

  const { ym } = useDashboardMonth();
  const cur = monthWindow(ym.year, ym.month);
  const prev = monthWindow(ym.year, ym.month - 1);

  const inRange = (iso: string | null | undefined, w: { start: number; end: number }) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= w.start && t < w.end;
  };

  const callsInMonth = rows.filter((c) => inRange(c.start_time, cur));
  const callsPrev = rows.filter((c) => inRange(c.start_time, prev));

  const bookingsInMonth = activeBookings.filter((b) => inRange(b.start, cur));

  const jobsInMonth = activeJobs.filter((j) => inRange(jobDate(j), cur));
  const jobsPrev = activeJobs.filter((j) => inRange(jobDate(j), prev));

  const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);

  const answered = callsInMonth.filter(isAnswered).length;
  const answeredPrev = callsPrev.filter(isAnswered).length;

  const booked = jobsInMonth.length;
  const bookedPrev = jobsPrev.length;

  const sumPrice = (js: JobRow[]) => js.reduce((s, j) => s + Number(j.price ?? 0), 0);
  const revenue = sumPrice(jobsInMonth);
  const revenuePrev = sumPrice(jobsPrev);

  const moneySaved = RECEPTIONIST_MONTHLY - ATYVIA_MONTHLY;
  const moneySavedPrev = moneySaved;

  // Cumulative-count sparkline across the selected month (12 buckets).
  const bucketByDate = (dates: (string | null | undefined)[]) => {
    const buckets = new Array(12).fill(0);
    const span = cur.end - cur.start;
    dates.forEach((iso) => {
      if (!iso) return;
      const t = new Date(iso).getTime();
      if (t < cur.start || t >= cur.end) return;
      const idx = Math.min(11, Math.floor(((t - cur.start) / span) * 12));
      buckets[idx] += 1;
    });
    let acc = 0;
    return buckets.map((n) => (acc += n));
  };

  // Cumulative revenue sparkline (£ per bucket) for the Money Earned card.
  const bucketBySum = (jobs: JobRow[]) => {
    const buckets = new Array(12).fill(0);
    const span = cur.end - cur.start;
    jobs.forEach((j) => {
      const iso = jobDate(j);
      if (!iso) return;
      const t = new Date(iso).getTime();
      if (t < cur.start || t >= cur.end) return;
      const idx = Math.min(11, Math.floor(((t - cur.start) / span) * 12));
      buckets[idx] += Number(j.price ?? 0);
    });
    let acc = 0;
    return buckets.map((n) => (acc += n));
  };

  const answeredSpark = bucketByDate(
    callsInMonth.filter(isAnswered).map((c) => c.start_time),
  );
  const jobsSpark = bucketByDate(jobsInMonth.map((j) => jobDate(j)));
  const revenueSpark = bucketBySum(jobsInMonth);

  const kpis = [
    {
      id: "answered",
      label: "Calls Answered",
      value: answered,
      delta: pct(answered, answeredPrev),
      sublabel: "So you didn't miss the job",
      spark: answeredSpark,
    },
    {
      id: "appts",
      label: "Jobs Booked",
      value: booked,
      delta: pct(booked, bookedPrev),
      sublabel: "From accepted quotes",
      spark: jobsSpark,
    },
    {
      id: "revenue",
      label: "Money Earned\nthrough Atyvia Bookings",
      value: Math.round(revenue),
      prefix: "£",
      delta: pct(revenue, revenuePrev),
      spark: revenueSpark,
    },
    {
      id: "saved",
      label: "Money Saved",
      value: moneySaved,
      prefix: "£",
      delta: pct(moneySaved, moneySavedPrev),
      sublabel: `Receptionist £${RECEPTIONIST_MONTHLY.toLocaleString()}/month\nAtyvia £${ATYVIA_MONTHLY.toLocaleString()}/month`,
      spark: new Array(12).fill(moneySaved),
    },
  ];

  // Calls by hour, weekday, reason — scoped to selected month.
  const hourCounts = new Array(24).fill(0);
  callsInMonth.forEach((c) => {
    if (!c.start_time) return;
    hourCounts[new Date(c.start_time).getHours()] += 1;
  });
  const callsByHour = hourCounts.map((calls, h) => ({ hour: `${h}:00`, calls }));

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayMap: Record<string, { calls: number; appts: number }> = {};
  dayNames.forEach((d) => (weekdayMap[d] = { calls: 0, appts: 0 }));
  callsInMonth.forEach((c) => {
    if (!c.start_time) return;
    const d = dayNames[new Date(c.start_time).getDay()];
    weekdayMap[d].calls += 1;
    if (c.booked_appointment) weekdayMap[d].appts += 1;
  });
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const callsByWeekday = order.map((day) => ({ day, ...weekdayMap[day] }));

  const reasonBuckets: Record<string, number> = {};
  callsInMonth.forEach((c) => {
    let key: string;
    if (c.booked_appointment) key = "Book appointment";
    else if (!isAnswered(c)) key = "Missed / voicemail";
    else if ((c.summary ?? "").toLowerCase().includes("price")) key = "Pricing enquiry";
    else if ((c.summary ?? "").toLowerCase().includes("reschedul")) key = "Reschedule";
    else key = "Other";
    reasonBuckets[key] = (reasonBuckets[key] ?? 0) + 1;
  });
  const totalReasons = Object.values(reasonBuckets).reduce((a, b) => a + b, 0) || 1;
  const palette = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];
  const callReasons = Object.entries(reasonBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n], i) => ({ name, value: Math.round((n / totalReasons) * 100), color: palette[i] }));

  // Revenue series — full Jan–Dec of the selected year, driven by actual bookings.
  const monthKey = (y: number, m: number) => `${y}-${m}`;
  const now = new Date();
  const nowYM: YearMonth = { year: now.getFullYear(), month: now.getMonth() };
  let latestBookingYM: YearMonth = MIN_YM;
  activeBookings.forEach((b) => {
    if (!b.start) return;
    const d = new Date(b.start);
    const cand: YearMonth = { year: d.getFullYear(), month: d.getMonth() };
    if (compareYM(cand, latestBookingYM) > 0) latestBookingYM = cand;
  });
  let endYM: YearMonth = nowYM;
  if (compareYM(latestBookingYM, endYM) > 0) endYM = latestBookingYM;
  if (compareYM(ym, endYM) > 0) endYM = ym;
  if (compareYM(endYM, MIN_YM) < 0) endYM = MIN_YM;

  const chartYear = ym.year;
  const months: { key: string; name: string; year: number; month: number; isSelected: boolean }[] = [];
  for (let m = 0; m < 12; m++) {
    months.push({
      key: monthKey(chartYear, m),
      name: new Date(chartYear, m, 1).toLocaleString("en", { month: "short" }),
      year: chartYear,
      month: m,
      isSelected: chartYear === ym.year && m === ym.month,
    });
  }
  const monthlyRevenue: Record<string, number> = {};
  const monthlyJobCount: Record<string, number> = {};
  months.forEach((m) => {
    monthlyRevenue[m.key] = 0;
    monthlyJobCount[m.key] = 0;
  });
  activeJobs.forEach((j) => {
    const iso = jobDate(j);
    if (!iso) return;
    const d = new Date(iso);
    const k = monthKey(d.getFullYear(), d.getMonth());
    if (monthlyRevenue[k] !== undefined) {
      monthlyRevenue[k] += Number(j.price ?? 0);
      monthlyJobCount[k] += 1;
    }
  });
  const revenueSeries = months.map((m) => ({
    name: m.name,
    generated: monthlyRevenue[m.key],
    bookings: monthlyJobCount[m.key],
    isSelected: m.isSelected,
  }));

  const totalSeconds = callsInMonth.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);
  const hoursSaved = Math.round(totalSeconds / 3600);

  const valueSummary = {
    aiHandled: callsInMonth.length,
    hoursSaved,
    salaryAvoided: RECEPTIONIST_MONTHLY,
    revenue: Math.round(revenue),
    booked,
  };

  // Live feed — most recent 10 calls overall (not month-scoped, this is "live").
  const feedItems = rows.slice(0, 10).map((c) => {
    let type: "answered" | "appt" | "missed" | "voicemail";
    let text: string;
    if (c.booked_appointment) {
      type = "appt";
      text = `Job booked${c.appointment_time ? ` · ${new Date(c.appointment_time).toLocaleString("en", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`;
    } else if (!isAnswered(c)) {
      type = (c.disconnect_reason ?? "").toLowerCase().includes("voicemail") ? "voicemail" : "missed";
      text = type === "voicemail" ? "Voicemail taken" : "Missed call";
    } else {
      type = "answered";
      text = c.summary ? `Call answered · ${c.summary.slice(0, 48)}` : "Call answered";
    }
    return {
      id: c.id,
      type,
      text,
      meta: c.caller_name ?? c.from_number ?? "Unknown caller",
      time: c.start_time ? timeAgo(new Date(c.start_time)) : "—",
    };
  });

  return {
    isLoading: q.isLoading,
    isError: q.isError,
    hasData: rows.length > 0,
    kpis,
    callsByHour,
    callsByWeekday,
    callReasons,
    revenueSeries,
    valueSummary,
    feedItems,
    recentCalls: callsInMonth,
    maxYm: endYM,
  };
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
