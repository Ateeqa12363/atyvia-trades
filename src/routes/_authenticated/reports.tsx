import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { StubPage } from "@/components/layout/StubPage";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Atyvia" }] }),
  component: () => (
    <StubPage
      title="Reports"
      description="Weekly, monthly, and quarterly reports — delivered on your schedule."
      icon={FileText}
      features={["PDF export", "CSV / Excel export", "Weekly automation", "Monthly automation", "Quarterly reviews", "Email delivery"]}
    />
  ),
});
