import type { CalBooking } from "@/lib/calendar.functions";

export type VisitKind = "quote" | "job";

/** Same classification the calendar uses, so every surface labels bookings identically. */
export function visitKind(b: CalBooking): VisitKind {
  if (b.metadata?.source === "atyvia-job") return "job";
  if (/^job\s*visit/i.test(b.title)) return "job";
  return "quote";
}

export const isCancelledStatus = (s: string) => /cancel/i.test(s);
