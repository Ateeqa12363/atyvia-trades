import { AnimatePresence, motion } from "framer-motion";
import {
  PhoneIncoming, CalendarPlus, UserCheck, PhoneForwarded, PhoneMissed, Voicemail, ShieldOff,
} from "lucide-react";
import { useAnalytics } from "@/hooks/useCallAnalytics";
import { cn } from "@/lib/utils";

const iconMap = {
  answered: { icon: PhoneIncoming, color: "text-secondary bg-secondary/15" },
  appt: { icon: CalendarPlus, color: "text-primary bg-primary/15" },
  lead: { icon: UserCheck, color: "text-secondary bg-secondary/15" },
  transfer: { icon: PhoneForwarded, color: "text-warning bg-warning/15" },
  missed: { icon: PhoneMissed, color: "text-destructive bg-destructive/15" },
  voicemail: { icon: Voicemail, color: "text-muted-foreground bg-muted/40" },
  spam: { icon: ShieldOff, color: "text-muted-foreground bg-muted/40" },
} as const;

export function LiveFeed() {
  const { feedItems, isLoading } = useAnalytics();
  const items = feedItems;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Live activity</h3>
          <p className="text-xs text-muted-foreground">Real-time call &amp; agent events</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-secondary" />
          </span>
          LIVE
        </div>
      </div>

      <div className="scrollbar-thin -mr-2 max-h-[420px] space-y-1.5 overflow-y-auto pr-2">
        {items.length === 0 && !isLoading && (
          <p className="py-8 text-center text-xs text-muted-foreground">No calls yet — activity will stream in here.</p>
        )}
        <AnimatePresence initial={false}>
          {items.map((it) => {
            const meta = iconMap[it.type] ?? iconMap.answered;
            const Icon = meta.icon;
            return (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/30"
              >
                <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", meta.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{it.text}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{it.meta}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{it.time}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
