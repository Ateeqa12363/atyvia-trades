import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, FileCheck2 } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { useDashboardMonth } from "./DashboardMonthContext";
import { listSiteVisits, listQuotes } from "@/lib/bookings.functions";

const monthWindow = (year: number, month: number) => {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  return { start, end };
};

const inRange = (iso: string | null | undefined, w: { start: number; end: number }) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= w.start && t < w.end;
};

const bucketize = (dates: (string | null | undefined)[], w: { start: number; end: number }) => {
  const buckets = new Array(12).fill(0);
  const span = w.end - w.start;
  dates.forEach((iso) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (t < w.start || t >= w.end) return;
    const idx = Math.min(11, Math.floor(((t - w.start) / span) * 12));
    buckets[idx] += 1;
  });
  let acc = 0;
  return buckets.map((n) => (acc += n));
};

export function BookingsFunnel() {
  const { selectedSiteId } = useSelectedSite();
  const { ym } = useDashboardMonth();
  const fetchVisits = useServerFn(listSiteVisits);
  const fetchQuotes = useServerFn(listQuotes);

  const visits = useQuery({
    queryKey: ["site-visits", selectedSiteId],
    queryFn: () => fetchVisits({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
  });
  const quotes = useQuery({
    queryKey: ["quotes", selectedSiteId],
    queryFn: () => fetchQuotes({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
  });

  const win = monthWindow(ym.year, ym.month);
  const prev = monthWindow(ym.year, ym.month - 1);

  const visitRows = (visits.data?.visits ?? []) as { scheduled_at: string | null; created_at?: string | null }[];
  const quoteRows = (quotes.data?.quotes ?? []) as { status: string; accepted_at: string | null; created_at?: string | null }[];

  const visitDate = (v: { scheduled_at: string | null; created_at?: string | null }) => v.scheduled_at ?? v.created_at ?? null;

  const visitsCount = visitRows.filter((v) => inRange(visitDate(v), win)).length;
  const visitsPrev = visitRows.filter((v) => inRange(visitDate(v), prev)).length;

  const acceptedInMonth = quoteRows.filter((q) => q.status === "accepted" && inRange(q.accepted_at, win)).length;
  const acceptedPrev = quoteRows.filter((q) => q.status === "accepted" && inRange(q.accepted_at, prev)).length;

  const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);

  const cards = [
    {
      id: "visits",
      label: "Site Visits",
      value: visitsCount,
      delta: pct(visitsCount, visitsPrev),
      spark: bucketize(visitRows.map(visitDate), win),
      icon: ClipboardList,
    },
    {
      id: "accepted",
      label: "Accepted Quotes",
      value: acceptedInMonth,
      delta: pct(acceptedInMonth, acceptedPrev),
      spark: bucketize(
        quoteRows.filter((q) => q.status === "accepted").map((q) => q.accepted_at),
        win,
      ),
      icon: FileCheck2,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => (
        <KpiCard
          key={c.id}
          label={c.label}
          value={c.value}
          delta={c.delta}
          spark={c.spark}
          icon={c.icon}
          index={i}
        />
      ))}
    </div>
  );
}
