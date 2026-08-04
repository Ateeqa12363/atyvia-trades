import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, MapPin, Phone, ClipboardList, Hammer, StickyNote } from "lucide-react";
import { format, isAfter, isSameDay } from "date-fns";
import { listCalBookings, type CalBooking } from "@/lib/calendar.functions";
import { visitKind, isCancelledStatus } from "@/lib/visit-kind";

/**
 * Mirrors the Calendar page: same Cal.com source, same query key, same
 * name/location/notes resolution, so the two never drift apart.
 */
export function UpcomingVisits() {
  const fetchBookings = useServerFn(listCalBookings);

  const { data, isLoading } = useQuery({
    queryKey: ["cal-bookings"],
    queryFn: () => fetchBookings(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const now = new Date();
  const visible = ((data?.bookings ?? []) as CalBooking[])
    .filter((b) => !isCancelledStatus(b.status) && b.start && isAfter(new Date(b.start), now))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 8);

  const error = (data as { error?: string } | undefined)?.error;

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-secondary" />
        <h3 className="text-sm font-semibold">Your next visits</h3>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
            <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No upcoming visits scheduled.</p>
          </div>
        ) : (
          visible.map((b) => {
            const kind = visitKind(b);
            const isJob = kind === "job";
            const location = b.address || b.location || null;
            return (
              <div
                key={b.id}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-l-4 border-border/60 px-3 py-2.5 ${
                  isJob ? "border-l-secondary bg-secondary/10" : "border-l-primary bg-primary/10"
                }`}
              >
                <div
                  className={`grid h-9 w-9 place-items-center rounded-lg ${
                    isJob ? "bg-secondary/15 text-secondary" : "bg-primary/10 text-primary"
                  }`}
                >
                  {isJob ? <Hammer className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {b.attendeeName || "Unnamed customer"}
                    <span
                      className={`ml-2 text-[10px] font-semibold uppercase tracking-wide ${
                        isJob ? "text-secondary" : "text-primary"
                      }`}
                    >
                      {isJob ? "Job visit" : "Quote visit"}
                    </span>
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {location && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{location}</span>
                      </span>
                    )}
                    {b.attendeePhone && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{b.attendeePhone}</span>
                      </span>
                    )}
                    {b.notes && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <StickyNote className="h-3 w-3 shrink-0" />
                        <span className="truncate">{b.notes}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold">
                    {isSameDay(new Date(b.start), now) ? "Today" : format(new Date(b.start), "EEE d MMM")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(b.start), "HH:mm")}
                    {b.end ? `–${format(new Date(b.end), "HH:mm")}` : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
