import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { StubPage } from "@/components/layout/StubPage";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({ meta: [{ title: "Revenue — Atyvia" }] }),
  component: () => (
    <StubPage
      title="Revenue"
      description="Attributed revenue, recovered opportunities, and lifetime customer value."
      icon={TrendingUp}
      features={["Revenue attribution", "LTV modelling", "Recovery reporting", "Missed opportunity", "Deal size analysis", "Forecasting"]}
    />
  ),
});
