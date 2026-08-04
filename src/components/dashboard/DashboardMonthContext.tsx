import { createContext, useContext, useState, type ReactNode } from "react";

export type YearMonth = { year: number; month: number }; // month is 0-11

// Atyvia usage starts July 2026 — no data before this month.
export const MIN_YM: YearMonth = { year: 2026, month: 6 };

const currentYM = (): YearMonth => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
};

export function compareYM(a: YearMonth, b: YearMonth) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function clampYM(ym: YearMonth, min: YearMonth, max: YearMonth): YearMonth {
  if (compareYM(ym, min) < 0) return min;
  if (compareYM(ym, max) > 0) return max;
  return ym;
}

const initialYM = (): YearMonth => {
  const now = currentYM();
  return compareYM(now, MIN_YM) < 0 ? MIN_YM : now;
};

type Ctx = {
  ym: YearMonth;
  setYm: (v: YearMonth) => void;
};

const DashboardMonthCtx = createContext<Ctx>({
  ym: initialYM(),
  setYm: () => {},
});

export function DashboardMonthProvider({ children }: { children: ReactNode }) {
  const [ym, setYm] = useState<YearMonth>(initialYM());
  return (
    <DashboardMonthCtx.Provider value={{ ym, setYm }}>
      {children}
    </DashboardMonthCtx.Provider>
  );
}

export const useDashboardMonth = () => useContext(DashboardMonthCtx);

export function ymLabel({ year, month }: YearMonth) {
  return new Date(year, month, 1).toLocaleString("en", { month: "long", year: "numeric" });
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const d = new Date(ym.year, ym.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function isCurrentMonth(ym: YearMonth) {
  const c = currentYM();
  return c.year === ym.year && c.month === ym.month;
}

export function isMinMonth(ym: YearMonth) {
  return compareYM(ym, MIN_YM) <= 0;
}
