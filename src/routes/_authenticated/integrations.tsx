import { createFileRoute } from "@tanstack/react-router";
import { Plug, CheckCircle2 } from "lucide-react";
import { GatedPage } from "@/components/GatedPage";
import { integrations } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Atyvia" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <GatedPage>
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary glow">
            <Plug className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
            <p className="text-sm text-muted-foreground">Connect Atyvia to your calendar, CRM, and payments stack.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((it) => {
            const connected = it.status === "connected";
            return (
              <div key={it.name} className="glass-card flex items-center gap-3 rounded-2xl p-4 transition-all hover:border-primary/30">
                <div className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-sm font-bold",
                  connected ? "border-secondary/40 bg-secondary/10 text-secondary" : "border-border bg-muted/30 text-muted-foreground",
                )}>
                  {it.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    {connected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-secondary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{it.category}</p>
                </div>
                <Button size="sm" variant={connected ? "outline" : "default"} className={cn(!connected && "bg-gradient-primary text-primary-foreground hover:opacity-90")}>
                  {connected ? "Manage" : "Connect"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </GatedPage>
  );
}
