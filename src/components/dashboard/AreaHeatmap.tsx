import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Crown } from "lucide-react";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { listJobs, listQuotes } from "@/lib/bookings.functions";
import { townForOutwardCode } from "@/lib/uk-postcode-towns";


type Job = { id: string; address: string | null; price: number | null; status: string | null };

// Reject anything that clearly isn't a real address (Cal.com video links,
// meeting integrations, empty strings). These flow through when a Cal.com
// event type is set to "video" — Cal.com writes the meeting URL into
// `location`, not the customer's address.
function isRealAddress(address: string | null): boolean {
  if (!address) return false;
  const s = address.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/^integrations?:/i.test(s)) return false;
  if (/cal\.com\/video/i.test(s)) return false;
  return true;
}

// Work out the town/city for an address. We read the UK outward postcode
// (e.g. "HP19") and translate it to the town people actually say ("Aylesbury"),
// falling back to a town-looking segment of the address, then the postcode itself.
function extractArea(address: string | null): { label: string; code: string | null } | null {
  if (!isRealAddress(address)) return null;
  const cleaned = address!.trim();
  // UK outward postcode regex — 1-2 letters, 1-2 digits, optional letter
  const match = cleaned.toUpperCase().match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)(?=\s*\d[A-Z]{2}\b|\s|,|$)/);
  const code = match ? match[1] : null;
  const town = townForOutwardCode(code);
  if (town) return { label: town, code };
  // Fallback: last non-numeric comma segment that isn't the postcode itself
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!p || /^\d/.test(p) || p.length >= 40) continue;
    if (code && p.toUpperCase().includes(code)) continue;
    return { label: p, code };
  }
  return code ? { label: code, code } : null;
}


type Quote = { id: string; address: string | null; total: number | null; status: string | null };

export function AreaHeatmap() {
  const { selectedSiteId } = useSelectedSite();
  const fetchJobs = useServerFn(listJobs);
  const fetchQuotes = useServerFn(listQuotes);

  const jq = useQuery({
    queryKey: ["jobs", selectedSiteId],
    queryFn: () => fetchJobs({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
  });
  const qq = useQuery({
    queryKey: ["quotes", selectedSiteId],
    queryFn: () => fetchQuotes({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
  });

  const areas = useMemo(() => {
    const jobs: Job[] = (jq.data?.jobs ?? []) as Job[];
    const quotes: Quote[] = (qq.data?.quotes ?? []) as Quote[];
    const bucket = new Map<string, { count: number; value: number; codes: Set<string> }>();
    const add = (address: string | null, value: number) => {
      const area = extractArea(address);
      if (!area) return;
      const cur = bucket.get(area.label) ?? { count: 0, value: 0, codes: new Set<string>() };
      cur.count += 1;
      cur.value += value;
      if (area.code) cur.codes.add(area.code);
      bucket.set(area.label, cur);
    };
    for (const j of jobs) {
      if (j.status === "cancelled") continue;
      add(j.address, Number(j.price ?? 0));
    }
    // Include open quotes so areas show up before acceptance too. Accepted
    // quotes are already represented as jobs, so skip them here.
    for (const q of quotes) {
      if (q.status === "declined" || q.status === "accepted") continue;
      add(q.address, Number(q.total ?? 0));
    }
    return Array.from(bucket.entries())
      .map(([area, v]) => ({ area, count: v.count, value: v.value, codes: Array.from(v.codes).sort() }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [jq.data, qq.data]);


  const maxValue = areas[0]?.value ?? 0;
  const total = areas.reduce((s, a) => s + a.value, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-gold/30 bg-card shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--gold)_45%,transparent)]">
      <div className="flex items-start justify-between gap-3 border-b border-gold/25 bg-gradient-to-r from-gold-soft via-gold-soft/60 to-transparent px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-ink-2 shadow-sm">
            <MapPin className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gold-deep">
              Where the money's coming from
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your best-earning areas — worth leafleting or advertising here.
            </p>
          </div>
        </div>
      </div>

      {areas.length === 0 ? (
        <div className="m-6 rounded-xl border border-dashed border-gold/40 p-8 text-center">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-gold/60" />
          <p className="text-xs font-medium">No job addresses picked up yet</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Add a booking question like <span className="font-medium">"Job address / postcode"</span>{" "}
            to your bookings — then we can map where your money's coming from.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gold/15">
          {areas.map((a, idx) => {
            const pct = maxValue > 0 ? Math.max(4, (a.value / maxValue) * 100) : 0;
            const share = total > 0 ? Math.round((a.value / total) * 100) : 0;
            const isTop = idx === 0;
            return (
              <div
                key={a.area}
                className={`px-6 py-3.5 transition-colors hover:bg-gold-soft/60 ${
                  isTop ? "bg-gold-soft/40" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={
                      isTop
                        ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-deep text-[11px] font-bold text-ink-2 shadow-sm"
                        : "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/12 text-[11px] font-semibold text-gold-deep"
                    }
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium">{a.area}</span>
                      {a.codes.length > 0 && (
                        <span className="shrink-0 rounded-md bg-gold/12 px-1.5 py-0.5 text-[10px] font-medium text-gold-deep">
                          {a.codes.slice(0, 3).join(", ")}
                        </span>
                      )}
                      {isTop && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-deep">
                          <Crown className="h-3 w-3" /> Top earner
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {a.count} {a.count === 1 ? "job" : "jobs"}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gold/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isTop
                            ? "bg-gradient-to-r from-gold-deep via-gold to-gold/60"
                            : "bg-gold/50"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-gold-deep">
                      £{Math.round(a.value).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{share}% of earnings</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

  );
}

