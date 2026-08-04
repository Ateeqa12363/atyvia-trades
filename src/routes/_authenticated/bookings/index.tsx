import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/bookings/")({
  beforeLoad: () => {
    throw redirect({ to: "/bookings/quotes" });
  },
});
