import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  delta: number;
  sublabel?: string;
  spark: number[];
  icon: LucideIcon;
  index?: number;
  accent?: boolean;
  invertDelta?: boolean;
}

export function KpiCard({
  label, value, prefix, suffix, sublabel, spark, icon: Icon, index = 0, accent,
}: KpiCardProps) {
  const data = spark.map((v, i) => ({ i, v }));
  const gradId = `spark-${label.replace(/\s+/g, "")}-${index}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl glass-card p-5 transition-all hover:border-primary/30 hover:shadow-[0_20px_60px_-20px_var(--color-primary)]",
        accent && "border-primary/30",
      )}
    >
      {accent && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5" aria-hidden />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-line text-[11px] font-medium uppercase leading-tight tracking-wider text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground lg:text-[26px]">
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
          </div>
          {sublabel && <p className="mt-1 whitespace-pre-line text-xs leading-snug text-muted-foreground">{sublabel}</p>}
        </div>
        <div className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-muted/40",
          accent && "border-primary/40 bg-primary/10",
        )}>
          <Icon className={cn("h-4 w-4", accent ? "text-secondary" : "text-muted-foreground")} />
        </div>
      </div>

      <div className="relative mt-4 flex items-end justify-end">
        <div className="h-10 w-full min-w-0 max-w-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="var(--color-secondary)" strokeWidth={1.8} fill={`url(#${gradId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
