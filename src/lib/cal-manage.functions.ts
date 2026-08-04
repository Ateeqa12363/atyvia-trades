import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CAL_HEADERS = () => ({
  Authorization: `Bearer ${process.env["CAL_COM_API_KEY"]}`,
  "cal-api-version": "2024-08-13",
  "Content-Type": "application/json",
});

/**
 * Move a Cal.com booking to a new start time. Cal.com issues a NEW uid on
 * reschedule, so we re-point any linked job / site visit at it and keep their
 * own date+time columns in step.
 */
export const rescheduleCalBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingUid: string; start: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    if (!process.env["CAL_COM_API_KEY"]) throw new Error("Cal.com isn't connected yet.");
    const startDate = new Date(data.start);
    if (Number.isNaN(startDate.getTime())) throw new Error("Invalid new time");

    const res = await fetch(`https://api.cal.com/v2/bookings/${data.bookingUid}/reschedule`, {
      method: "POST",
      headers: CAL_HEADERS(),
      body: JSON.stringify({
        start: startDate.toISOString(),
        reschedulingReason: data.reason || "Moved by the tradesperson in Atyvia",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[cal.com] reschedule failed [${res.status}]: ${body}`);
      throw new Error(`Couldn't move that booking (${res.status}). ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: { uid?: string; id?: number } };
    const newUid = json.data?.uid || (json.data?.id != null ? String(json.data.id) : null);

    // Keep our own records in step with the new slot.
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(startDate);
    const part = (t: string) => local.find((p) => p.type === t)?.value ?? "00";
    const scheduledDate = `${part("year")}-${part("month")}-${part("day")}`;
    const scheduledTime = `${part("hour")}:${part("minute")}`;

    await context.supabase
      .from("jobs")
      .update({
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        ...(newUid ? { cal_booking_id: newUid } : {}),
      })
      .eq("cal_booking_id", data.bookingUid);

    await context.supabase
      .from("site_visits")
      .update({
        scheduled_at: startDate.toISOString(),
        ...(newUid ? { cal_booking_id: newUid } : {}),
      })
      .eq("cal_booking_id", data.bookingUid);

    return { ok: true, uid: newUid };
  });

/** Cancel/delete a Cal.com booking and mark anything linked to it as cancelled. */
export const cancelCalBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingUid: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    if (!process.env["CAL_COM_API_KEY"]) throw new Error("Cal.com isn't connected yet.");
    const res = await fetch(`https://api.cal.com/v2/bookings/${data.bookingUid}/cancel`, {
      method: "POST",
      headers: CAL_HEADERS(),
      body: JSON.stringify({ cancellationReason: data.reason || "Cancelled in Atyvia" }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[cal.com] cancel failed [${res.status}]: ${body}`);
      throw new Error(`Couldn't delete that booking (${res.status}). ${body.slice(0, 200)}`);
    }

    await context.supabase
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("cal_booking_id", data.bookingUid);
    await context.supabase
      .from("site_visits")
      .update({ status: "cancelled" })
      .eq("cal_booking_id", data.bookingUid);

    return { ok: true };
  });

/** Create a calendar entry by hand (quote visit or job visit) straight into Cal.com. */
export const createCalBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      kind: "quote" | "job";
      date: string; // yyyy-MM-dd
      time: string; // HH:mm
      durationMinutes: number;
      customerName: string;
      customerEmail?: string | null;
      phone?: string | null;
      address?: string | null;
      notes?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!process.env["CAL_COM_API_KEY"]) throw new Error("Cal.com isn't connected yet.");
    const eventTypeIdRaw = process.env["CAL_COM_JOB_EVENT_TYPE_ID"];
    if (!eventTypeIdRaw || !/^\d+$/.test(eventTypeIdRaw)) {
      throw new Error("Cal.com event type isn't configured yet.");
    }
    const start = new Date(`${data.date}T${data.time}:00`);
    if (Number.isNaN(start.getTime())) throw new Error("Pick a valid date and time.");

    const name = data.customerName.trim() || "Customer";
    const email = (data.customerEmail || "").trim() || `manual-${Date.now()}@atyvia.app`;
    const title = data.kind === "job" ? `Job visit — ${name}` : `Quote visit — ${name}`;

    const res = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: CAL_HEADERS(),
      body: JSON.stringify({
        start: start.toISOString(),
        eventTypeId: Number(eventTypeIdRaw),
        lengthInMinutes: data.durationMinutes > 0 ? data.durationMinutes : 60,
        attendee: {
          name,
          email,
          timeZone: "Europe/London",
          language: "en",
          ...(data.phone ? { phoneNumber: data.phone } : {}),
        },
        bookingFieldsResponses: {
          title,
          name,
          email,
          attendeePhoneNumber: data.phone || "",
          jobAddress: data.address || "TBC",
          notes: data.notes || "",
        },
        metadata: { source: data.kind === "job" ? "atyvia-job" : "atyvia-quote-visit" },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[cal.com] manual create failed [${res.status}]: ${body}`);
      throw new Error(`Couldn't add that entry (${res.status}). ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: { uid?: string; id?: number } };
    return { ok: true, uid: json.data?.uid ?? (json.data?.id != null ? String(json.data.id) : null) };
  });
