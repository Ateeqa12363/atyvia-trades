import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { StubPage } from "@/components/layout/StubPage";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({ meta: [{ title: "Appointments — Atyvia" }] }),
  component: () => (
    <StubPage
      title="Appointments"
      description="Bookings, confirmations, reschedules, and no-show tracking in one view."
      icon={CalendarDays}
      features={["Calendar sync", "Confirmations & reminders", "Reschedule flows", "No-show tracking", "Multi-location", "Staff assignment"]}
    />
  ),
});
