import { createFileRoute } from "@tanstack/react-router";
import { UsersRound } from "lucide-react";
import { StubPage } from "@/components/layout/StubPage";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — Atyvia" }] }),
  component: () => (
    <StubPage
      title="Team"
      description="Invite teammates, manage roles, and audit account activity."
      icon={UsersRound}
      features={["Role-based access", "Location scoping", "Activity audit", "SSO / SAML", "SCIM provisioning", "Approval workflows"]}
    />
  ),
});
