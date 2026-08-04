import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Repeat, Phone, Mail, MapPin, Search, Download } from "lucide-react";
import { GatedPage } from "@/components/GatedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { listCustomers, type Customer } from "@/lib/customers.functions";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Repeat customer book | Atyvia" },
      {
        name: "description",
        content:
          "Every customer logged automatically from completed jobs — repeat customers, work history, spend and towns for marketing.",
      },
      { property: "og:title", content: "Customers — Repeat customer book | Atyvia" },
      {
        property: "og:description",
        content:
          "Automatic customer records built from your jobs: repeat customers, lifetime spend and work history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

const fmt = (n: number) => `£${Number(n || 0).toFixed(2)}`;
const day = (d: string | null) =>
  d ? format(new Date(`${d}T00:00:00`), "d MMM yyyy") : "—";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";


function CustomersPage() {
  const { selectedSiteId } = useSelectedSite();
  const fetchCustomers = useServerFn(listCustomers);
  const [q, setQ] = useState("");
  const [onlyRepeat, setOnlyRepeat] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", selectedSiteId],
    queryFn: () => fetchCustomers({ data: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
  });

  const customers = (data?.customers ?? []) as Customer[];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (onlyRepeat && !c.repeat) return false;
      if (!term) return true;
      return [c.name, c.phone, c.email, c.address, c.town]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [customers, q, onlyRepeat]);


  const active = customers.find((c) => c.key === openKey) ?? null;

  const exportCsv = () => {
    const rows = [
      ["Name", "Phone", "Email", "Town", "Address", "Jobs", "Completed", "Revenue", "First job", "Last job", "Repeat"],
      ...filtered.map((c) => [
        c.name,
        c.phone ?? "",
        c.email ?? "",
        c.town ?? "",
        (c.address ?? "").replace(/\n/g, " "),
        String(c.jobCount),
        String(c.completedCount),
        c.revenue.toFixed(2),
        c.firstJob ?? "",
        c.lastJob ?? "",
        c.repeat ? "yes" : "no",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "atyvia-customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <GatedPage>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Customers
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Customer book</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Spot repeat customers and use the data for local marketing.

            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>


        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, town…"
              className="pl-9"
            />
          </div>
          <Button
            variant={onlyRepeat ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyRepeat((v) => !v)}
          >
            <Repeat className="mr-2 h-4 w-4" /> Repeat only
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading customers…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No customers yet — they appear here automatically as jobs are booked and
              completed.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div className="col-span-4 sm:col-span-3">Customer</div>
              <div className="col-span-3 hidden sm:block">Address</div>
              <div className="col-span-2 text-right sm:col-span-1">Jobs</div>
              <div className="col-span-3 text-right sm:col-span-2">Revenue</div>
              <div className="col-span-3 hidden text-right sm:block sm:col-span-2">Last job</div>
              <div className="col-span-2 text-right sm:col-span-1"></div>
            </div>
            {filtered.map((c) => (
              <button
                key={c.key}
                onClick={() => setOpenKey(c.key)}
                className="grid w-full grid-cols-12 items-center gap-4 border-b px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/30"
              >
                <div className="col-span-4 flex items-center gap-3 sm:col-span-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    {c.repeat && (
                      <Badge className="mt-0.5 bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/15">
                        Repeat
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="col-span-3 hidden truncate text-left text-sm text-muted-foreground sm:block">
                  {c.town ?? c.address ?? "—"}
                </div>
                <div className="col-span-2 text-right text-sm tabular-nums sm:col-span-1">
                  {c.jobCount}
                </div>
                <div className="col-span-3 text-right text-sm font-semibold tabular-nums sm:col-span-2">
                  {fmt(c.revenue)}
                </div>
                <div className="col-span-3 hidden text-right text-sm text-muted-foreground sm:block sm:col-span-2">
                  <span className="block">{day(c.lastJob)}</span>
                  {c.lastJob && (
                    <span className="block text-[11px] text-muted-foreground/70">
                      {format(new Date(`${c.lastJob}T00:00:00`), "EEEE")}
                    </span>
                  )}
                </div>

                <div className="col-span-2 text-right text-xs text-muted-foreground sm:col-span-1">
                  View
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenKey(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {active.name}
                  {active.repeat && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
                      Repeat customer
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {active.phone && (
                    <a
                      href={`tel:${active.phone}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" /> {active.phone}
                    </a>
                  )}
                  {active.email && (
                    <a
                      href={`mailto:${active.email}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4" /> {active.email}
                    </a>
                  )}
                  {active.address && (
                    <p className="flex items-start gap-2 sm:col-span-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>
                        {active.address}
                        {active.town ? ` · ${active.town}` : ""}
                      </span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Jobs", String(active.jobCount)],
                    ["Completed", String(active.completedCount)],
                    ["Total value", fmt(active.revenue)],
                    ["Paid", fmt(active.paidRevenue)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {label}
                      </p>
                      <p className="text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Customer since {day(active.firstJob)} · {active.quoteCount} quote
                  {active.quoteCount === 1 ? "" : "s"} · {active.callCount} call
                  {active.callCount === 1 ? "" : "s"}
                </p>

                <div>
                  <h2 className="mb-2 text-sm font-medium">Work history</h2>
                  <div className="space-y-2">
                    {active.jobs.map((j) => (
                      <div key={j.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{day(j.date)}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">
                              {j.status.replace("_", " ")}
                            </Badge>
                            <span className="text-sm font-semibold">
                              {fmt(j.invoiced || j.price)}
                            </span>
                          </div>
                        </div>
                        {j.description ? (
                          <p className="mt-1.5 whitespace-pre-wrap text-xs text-foreground/80">
                            {j.description}
                          </p>
                        ) : j.notes ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            {j.notes}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            No quote details on this job yet
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </GatedPage>
  );
}
