import { createFileRoute } from "@tanstack/react-router";
import { CallAnalytics } from "@/components/dashboard/CallAnalytics";
import { useAnalytics } from "@/hooks/useCallAnalytics";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Atyvia" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { isLoading, hasData, recentCalls, kpis } = useAnalytics();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Live from Retell</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLoading
            ? "Loading your call data…"
            : hasData
              ? `Based on ${recentCalls.length} calls in the last 30 days.`
              : "No calls yet — data will appear as Retell sends webhook events."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.id} className="glass-card rounded-2xl p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {k.prefix}{Math.round(k.value).toLocaleString()}
            </div>
            {k.sublabel && <p className="mt-1 text-xs text-muted-foreground">{k.sublabel}</p>}
          </div>
        ))}
      </div>

      <CallAnalytics />
    </div>
  );
}
