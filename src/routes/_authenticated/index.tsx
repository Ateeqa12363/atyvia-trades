import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { Paywall } from "@/components/Paywall";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Atyvia" },
      { name: "description", content: "Real-time AI Voice Agent business intelligence: calls, revenue, appointments, and ROI." },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  const { isActive, loading } = useSubscription();
  return (
    <AppLayout>
      {loading ? (
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : isActive ? (
        <DashboardHome />
      ) : (
        <Paywall />
      )}
    </AppLayout>
  );
}
