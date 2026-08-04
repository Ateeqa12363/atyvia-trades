
import type { LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

export function StubPage({
  title,
  description,
  icon: Icon,
  features,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
}) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary glow">
            <Icon className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="glass-card relative overflow-hidden rounded-2xl p-10 text-center">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-primary/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-secondary">Coming next</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              This module is fully wired to the Atyvia data model
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              We're rolling out {title.toLowerCase()} in the next release. Track what's shipping and request early access.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90">Request early access</Button>
              <Button variant="outline">View roadmap</Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f} className="glass-card rounded-2xl p-4 text-sm">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Feature</div>
              <div className="mt-1 font-medium">{f}</div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

