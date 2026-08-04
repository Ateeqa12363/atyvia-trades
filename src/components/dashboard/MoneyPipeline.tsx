import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PoundSterling, ThumbsUp } from "lucide-react";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { listQuotes } from "@/lib/bookings.functions";
import { useDashboardMonth } from "./DashboardMonthContext";

type Quote = {
  id: string;
  total: number | null;
  status: string | null;
  created_at: string | null;
  accepted_at?: string | null;
};

export function MoneyPipeline() {
  const { selectedSiteId } = useSelectedSite();
  const fetchQuotes = useServerFn(listQuotes);
  const { ym } = useDashboardMonth();

  const qq = useQuery({
    queryKey: ["quotes", selectedSiteId],
    queryFn: () => fetchQuotes({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });

  const quotes: Quote[] = (qq.data?.quotes ?? []) as Quote[];

  const monthStart = new Date(ym.year, ym.month, 1).getTime();
  const monthEnd = new Date(ym.year, ym.month + 1, 1).getTime();
  const inMonth = (iso?: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= monthStart && t < monthEnd;
  };

  // Live pipeline — everything not yet closed out
  const openQuotes = quotes.filter((q) => q.status === "draft" || q.status === "sent");
  const openValue = openQuotes.reduce((s, q) => s + Number(q.total ?? 0), 0);




  // "Out of every 10 quotes, how many turn into jobs?" — plain-English conversion.
  // Base: quotes that reached a decision (accepted + declined). Ignore drafts/sent so
  // waiting quotes don't drag the score down.
  const decided = quotes.filter((q) => q.status === "accepted" || q.status === "declined").length;
  const acceptedAll = quotes.filter((q) => q.status === "accepted").length;
  const outOfTen = decided === 0 ? null : Math.round((acceptedAll / decided) * 10);

  const tiles = [
    {
      key: "out",
      label: "Quotes out the door",
      hint: "Money you're waiting to hear back on",
      value: `£${Math.round(openValue).toLocaleString()}`,
      sub: `${openQuotes.length} ${openQuotes.length === 1 ? "quote" : "quotes"} in play`,
      icon: PoundSterling,
      tone: "text-sky-500 bg-sky-500/10",
    },
    {

      key: "ratio",
      label: "Quotes that turn into jobs",
      hint: outOfTen === null ? "No decisions in yet" : `${outOfTen} out of every 10`,
      value: outOfTen === null ? "—" : `${outOfTen}/10`,
      sub:
        outOfTen === null
          ? "Send a few quotes to see your hit rate"
          : outOfTen >= 6
            ? "Great hit rate — keep it up"
            : outOfTen >= 4
              ? "Solid — a follow-up call often tips it"
              : "Room to grow — try faster quotes",
      icon: ThumbsUp,
      tone: "text-amber-500 bg-amber-500/10",
    },
  ];

  return (
    <div className="glass-card rounded-2xl p-6">
      <div>
        <h3 className="text-sm font-semibold">Money in the pipeline</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          What's already earning and what's on the way.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <div key={t.key} className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className={`grid h-9 w-9 place-items-center rounded-lg ${t.tone}`}>
              <t.icon className="h-4 w-4" />
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight">{t.value}</div>
            <p className="text-xs font-medium">{t.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">{t.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
