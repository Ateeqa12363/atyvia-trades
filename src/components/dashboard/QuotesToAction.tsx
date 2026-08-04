import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { FileText, Send, CheckCircle2, ArrowRight } from "lucide-react";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { listQuotes, listJobs } from "@/lib/bookings.functions";

type Quote = {
  id: string;
  customer_name: string | null;
  total: number | null;
  status: string | null;
  site_visit_id: string | null;
};

type Job = { id: string; scheduled_date: string | null; status: string | null };

export function QuotesToAction() {
  const { selectedSiteId } = useSelectedSite();
  const fetchQuotes = useServerFn(listQuotes);
  const fetchJobs = useServerFn(listJobs);

  const qq = useQuery({
    queryKey: ["quotes", selectedSiteId],
    queryFn: () => fetchQuotes({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });
  const jq = useQuery({
    queryKey: ["jobs", selectedSiteId],
    queryFn: () => fetchJobs({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });

  const quotes: Quote[] = (qq.data?.quotes ?? []) as Quote[];
  const jobs: Job[] = (jq.data?.jobs ?? []) as Job[];

  const drafts = quotes.filter((q) => q.status === "draft");
  const waiting = quotes.filter((q) => q.status === "sent");
  // Accepted quotes that don't have a scheduled job date yet
  const accepted = quotes.filter((q) => q.status === "accepted");
  const unscheduled = accepted.filter(() => {
    // Simple heuristic: any accepted quote whose matching job has no scheduled_date
    // (jobs are created 1:1 from accepted quotes with status "booked").
    return jobs.some((j) => j.status === "booked" && !j.scheduled_date);
  });
  // Fallback — if we can't match reliably, just show all accepted-but-unbooked jobs count
  const bookMeIn = unscheduled.length > 0 ? unscheduled.length : jobs.filter((j) => j.status === "booked" && !j.scheduled_date).length;

  const tiles = [
    {
      key: "draft",
      label: "Ready to send",
      hint: "You've quoted, just needs sending",
      count: drafts.length,
      value: drafts.reduce((s, q) => s + Number(q.total ?? 0), 0),
      icon: FileText,
      tone: "text-amber-500 bg-amber-500/10",
      to: "/bookings/quotes",
    },
    {
      key: "sent",
      label: "Waiting on customer",
      hint: "Sent — give them a nudge",
      count: waiting.length,
      value: waiting.reduce((s, q) => s + Number(q.total ?? 0), 0),
      icon: Send,
      tone: "text-sky-500 bg-sky-500/10",
      to: "/bookings/quotes",
    },
    {
      key: "book",
      label: "Accepted",
      hint: "Customer said yes, book in a date to complete the job",
      count: bookMeIn,
      value: accepted.reduce((s, q) => s + Number(q.total ?? 0), 0),
      icon: CheckCircle2,
      tone: "text-emerald-500 bg-emerald-500/10",
      to: "/bookings/jobs",
    },
  ];

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Quotes needing your attention</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Where the money's stuck — clear these and your week gets easier.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            className="group rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`grid h-9 w-9 place-items-center rounded-lg ${t.tone}`}>
                <t.icon className="h-4 w-4" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight">{t.count}</div>
            <p className="text-xs font-medium">{t.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
