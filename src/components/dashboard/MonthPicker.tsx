import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  compareYM,
  isMinMonth,
  shiftMonth,
  useDashboardMonth,
  ymLabel,
  type YearMonth,
} from "./DashboardMonthContext";

export function MonthPicker({ maxYm }: { maxYm: YearMonth }) {
  const { ym, setYm } = useDashboardMonth();
  const atMin = isMinMonth(ym);
  const atMax = compareYM(ym, maxYm) >= 0;

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 disabled:opacity-30"
        onClick={() => setYm(shiftMonth(ym, -1))}
        disabled={atMin}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex min-w-[9.5rem] items-center justify-center gap-2 px-2 text-xs font-medium">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        {ymLabel(ym)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 disabled:opacity-30"
        onClick={() => setYm(shiftMonth(ym, 1))}
        disabled={atMax}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
