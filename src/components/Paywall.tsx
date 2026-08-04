import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Plan = { name: string; price: string; features: string[]; highlight?: boolean };

const plans: Plan[] = [
  {
    name: "Growth",
    price: "£577",
    features: ["Up to 1,000 calls/mo", "24/7 AI receptionist", "Calendar integrations", "Email support"],
  },
  {
    name: "Scale",
    price: "£1,199",
    features: ["Up to 5,000 calls/mo", "Priority routing", "Custom voice & branding", "Priority support"],
    highlight: true,
  },
];

export function Paywall({ featureName }: { featureName?: string }) {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-secondary/15">
          <Lock className="h-6 w-6 text-secondary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {featureName ? `${featureName} requires an active plan` : "Choose a plan to continue"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlock the full Atyvia dashboard, calls, analytics, and integrations.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">All prices exclude VAT · VAT added at checkout</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 text-left">
          {plans.map((p) => (
            <div key={p.name} className={`glass-card rounded-2xl p-5 ${p.highlight ? "ring-1 ring-secondary/40" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{p.name}</div>
                {p.highlight && <Badge className="bg-secondary/20 text-secondary text-[10px]">Popular</Badge>}
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {p.price}<span className="text-sm font-normal text-muted-foreground">/mo excl. VAT</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2">
            <Link to="/billing"><Sparkles className="h-4 w-4" /> Choose a plan</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/contact">Contact sales</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
