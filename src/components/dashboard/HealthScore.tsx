import { motion } from "framer-motion";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { CheckCircle2, Sparkles } from "lucide-react";
import { healthScore } from "@/lib/mock-data";
import { AnimatedCounter } from "./AnimatedCounter";

export function HealthScore() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Client Health Score</h3>
          <p className="text-xs text-muted-foreground">AI-generated business score</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">
          <Sparkles className="h-3 w-3" /> AI
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="relative grid h-40 w-40 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="42" stroke="var(--color-border)" strokeWidth="6" fill="none" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              stroke="url(#healthGrad)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - healthScore.score / 100) }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="healthGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" />
                <stop offset="100%" stopColor="var(--color-secondary)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="text-center">
            <div className="text-4xl font-bold tracking-tight text-foreground">
              <AnimatedCounter value={healthScore.score} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Excellent</div>
          </div>
        </div>

        <div className="h-40 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={healthScore.factors} outerRadius="80%">
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }} />
              <Radar dataKey="value" stroke="var(--color-secondary)" fill="var(--color-secondary)" fillOpacity={0.25} strokeWidth={1.6} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-border/60 pt-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recommendations</p>
        {healthScore.recommendations.map((r) => (
          <div key={r} className="flex items-start gap-2 text-xs text-foreground/90">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
            <span>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
