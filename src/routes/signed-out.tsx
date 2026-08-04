import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signed-out")({
  head: () => ({ meta: [{ title: "Signed out — Atyvia" }] }),
  component: SignedOutPage,
});

function SignedOutPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="glass-card w-full max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary glow">
          <LogOut className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You've been signed out</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks for using Atyvia. Your session has ended securely.
        </p>
        <Button asChild className="mt-6 bg-gradient-primary text-primary-foreground hover:opacity-90">
          <Link to="/">Sign back in</Link>
        </Button>
      </div>
    </div>
  );
}
