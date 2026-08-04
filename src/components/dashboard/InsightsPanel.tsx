import { motion } from "framer-motion";
import { AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { insights } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const iconFor = {
  growth: { icon: TrendingUp, ring: "border-secondary/30 bg-secondary/10 text-secondary" },
  opportunity: { icon: Sparkles, ring: "border-primary/30 bg-primary/10 text-primary" },
  warning: { icon: AlertTriangle, ring: "border-warning/30 bg-warning/10 text-warning" },
} as const;

export function InsightsPanel() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI insights</h3>
            <p className="text-xs text-muted-foreground">Generated 4 minutes ago</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {insights.map((it, i) => {
          const meta = iconFor[it.kind as keyof typeof iconFor];
          const Icon = meta.icon;
          return (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-all hover:border-primary/30 hover:bg-muted/40"
            >
              <div className={cn("mb-2 inline-grid h-7 w-7 place-items-center rounded-lg border", meta.ring)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm font-medium leading-snug">{it.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{it.body}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
