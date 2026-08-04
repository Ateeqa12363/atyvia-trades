import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Clock, PhoneCall, Check, Headphones } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — Atyvia" }] }),
  component: ContactPage,
});

const steps = [
  ["01", "We ring you back today — real person, quick chat."],
  ["02", "Tell us your services, prices and hours (10 mins)."],
  ["03", "We train Atyvia on your business overnight."],
  ["04", "You ring a test number and hear it answer as you."],
];

function ContactPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-[900px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary glow">
            <Headphones className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contact Atyvia</h1>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Email */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
                <Mail className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">Email us</h2>
                <p className="text-sm text-muted-foreground">For any question or request.</p>
              </div>
            </div>
            <a
              href="mailto:contact@atyvia.com"
              className="mt-4 block text-lg font-semibold text-foreground hover:underline"
            >
              contact@atyvia.com
            </a>
            <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0 mt-0.5" />
              <p>We answer every enquiry within one working day — usually sooner, because we practise what we sell.</p>
            </div>
            <Button asChild className="mt-6 bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2">
              <a href="mailto:contact@atyvia.com">Send email</a>
            </Button>
          </div>

          {/* Hear it live */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
                <PhoneCall className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">Hear it live</h2>
                <p className="text-sm text-muted-foreground">No slides, no sales pitch.</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Drop us a note and we’ll ring you back today — no forms, no waffle, no pushy salespeople.
            </p>
            <ol className="mt-4 space-y-3 text-sm">
              {steps.map(([n, text]) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary/10 text-[10px] font-semibold text-secondary">
                    {n}
                  </span>
                  <span className="text-foreground/90">{text}</span>
                </li>
              ))}
            </ol>
            <Button asChild variant="outline" className="mt-6 gap-2">
              <a href="mailto:contact@atyvia.com?subject=Hear%20it%20live">Request a live call</a>
            </Button>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-sm text-muted-foreground">
          Prefer to browse?{" "}
          <Link to="/" className="font-medium text-foreground hover:underline">
            Return to the dashboard
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
