import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { pipeline, upcomingAppointments } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function PipelineAppointments() {
  const max = Math.max(...pipeline.map((p) => p.count));
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="glass-card rounded-2xl p-5 lg:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Lead pipeline</h3>
            <p className="text-xs text-muted-foreground">Conversion by stage</p>
          </div>
          <span className="text-xs text-muted-foreground">This month</span>
        </div>
        <div className="space-y-3">
          {pipeline.map((p, i) => {
            const width = (p.count / max) * 100;
            const next = pipeline[i + 1];
            const conv = next ? ((next.count / p.count) * 100).toFixed(0) : null;
            const isLost = p.stage === "Lost";
            return (
              <div key={p.stage}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{p.stage}</span>
                  <span className="text-muted-foreground">{p.count.toLocaleString()}</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-muted/40">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.06 }}
                    className={cn(
                      "h-full rounded-full",
                      isLost ? "bg-destructive/60" : "bg-gradient-primary",
                    )}
                  />
                </div>
                {conv && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    <span className="text-secondary">{conv}%</span> convert to {next.stage}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Upcoming appointments</h3>
            <p className="text-xs text-muted-foreground">Next 24 hours</p>
          </div>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          {upcomingAppointments.map((a) => (
            <div key={a.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-primary text-xs font-semibold text-primary-foreground">
                {a.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{a.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{a.service} · {a.time}</p>
              </div>
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                a.status === "confirmed" ? "bg-secondary/15 text-secondary" : "bg-warning/15 text-warning",
              )}>
                {a.status === "confirmed" && <CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5" />}
                {a.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
