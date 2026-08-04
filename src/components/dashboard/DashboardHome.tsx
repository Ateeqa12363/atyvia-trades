import { PhoneIncoming, CalendarCheck, PoundSterling, PiggyBank } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { UpcomingVisits } from "./UpcomingVisits";
import { LiveFeed } from "./LiveFeed";
import { ValueCalculator } from "./ValueCalculator";
import { MonthPicker } from "./MonthPicker";
import { QuotesToAction } from "./QuotesToAction";
import { AreaHeatmap } from "./AreaHeatmap";
import { DashboardMonthProvider, useDashboardMonth, ymLabel } from "./DashboardMonthContext";
import { useAnalytics } from "@/hooks/useCallAnalytics";
import { QuoteCopilotWidget } from "@/components/quotes/QuoteCopilotWidget";

const iconMap: Record<string, typeof PhoneIncoming> = {
  answered: PhoneIncoming,
  appts: CalendarCheck,
  revenue: PoundSterling,
  saved: PiggyBank,
};

export function DashboardHome() {
  return (
    <DashboardMonthProvider>
      <DashboardHomeInner />
    </DashboardMonthProvider>
  );
}

function DashboardHomeInner() {
  const { kpis, maxYm } = useAnalytics();
  const { ym } = useDashboardMonth();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker maxYm={maxYm} />
        </div>
      </div>

      {/* KPI grid — hide revenue (shown in Value Calculator instead) */}
      <div className="grid gap-3 sm:grid-cols-2">
        {kpis.filter((k) => k.id !== "revenue" && k.id !== "saved").map((k, i) => (
          <KpiCard
            key={k.id}
            label={k.label}
            value={k.value}
            prefix={k.prefix}
            delta={k.delta}
            sublabel={k.sublabel}
            spark={k.spark}
            icon={iconMap[k.id] ?? PhoneIncoming}
            index={i}
            accent={k.id === "saved"}
          />
        ))}
      </div>

      {/* Quotes needing attention */}
      <QuotesToAction />

      {/* Value calculator */}
      <ValueCalculator />






      {/* Upcoming visits + live feed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><UpcomingVisits /></div>
        <LiveFeed />
      </div>

      {/* Where the money's coming from */}
      <AreaHeatmap />

      {/* Floating AI quote copilot */}
      <QuoteCopilotWidget />
    </div>
  );
}
