import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { StubPage } from "@/components/layout/StubPage";

export const Route = createFileRoute("/_authenticated/ai-performance")({
  head: () => ({ meta: [{ title: "AI Performance — Atyvia" }] }),
  component: () => (
    <StubPage
      title="AI Performance"
      description="Deep evaluation of every AI conversation: quality, accuracy, and outcomes."
      icon={Sparkles}
      features={["Booking rate", "Qualification rate", "Knowledge accuracy", "Transfer success", "Sentiment scoring", "Conversation score"]}
    />
  ),
});
