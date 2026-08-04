import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, Check, Sparkles, Download, X, ExternalLink, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { createPortalSession, listInvoices } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — Atyvia" }] }),
  component: BillingPage,
});

type Plan = {
  name: string;
  price: string;
  priceId?: string;
  features: string[];
  highlight?: boolean;
  enterprise?: boolean;
};

const plans: Plan[] = [
  {
    name: "Growth",
    price: "£577",
    priceId: "growth_monthly",
    features: ["Up to 1,000 calls/mo", "24/7 AI receptionist", "Calendar integrations", "Email support"],
  },
  {
    name: "Scale",
    price: "£1,199",
    priceId: "scale_monthly",
    features: ["Up to 5,000 calls/mo", "Priority routing", "Custom voice & branding", "Priority support"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: ["Unlimited calls", "SSO / SAML", "Dedicated CSM", "Custom SLAs"],
    enterprise: true,
  },
];

type Invoice = {
  id: string;
  number: string | null;
  created: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(iso: string | null | number) {
  if (!iso) return "—";
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function BillingPage() {
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const { subscription, isActive, loading, refetch } = useSubscription();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!isActive) { setInvoices([]); return; }
    let cancelled = false;
    setInvoicesLoading(true);
    (async () => {
      try {
        const res = await listInvoices({ data: { environment: getStripeEnvironment() } });
        if (cancelled) return;
        if ("error" in res) toast.error(res.error);
        else setInvoices(res.invoices);
      } finally {
        if (!cancelled) setInvoicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isActive, subscription?.stripe_customer_id]);

  const currentPlan = plans.find((p) => p.priceId && p.priceId === subscription?.price_id);

  const startUpgrade = (plan: Plan) => {
    if (plan.enterprise) return;
    if (!plan.priceId) return;
    openCheckout({
      priceId: plan.priceId,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      onAlreadySubscribed: () => {
        toast.info("You're already on this plan.");
        closeCheckout();
        void refetch();
      },
    });
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await createPortalSession({
        data: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/billing`,
        },
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <AppLayout>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary glow">
            <CreditCard className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
            <p className="text-sm text-muted-foreground">Manage your plan, payment method, and invoices.</p>
          </div>
        </div>

        {/* Current plan */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your plan…
            </div>
          ) : isActive && subscription ? (
            <div className={`${subscription.cancel_at_period_end ? "-m-6 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Current plan</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-semibold">{currentPlan?.name ?? subscription.price_id ?? "Subscription"}</h2>
                    {subscription.cancel_at_period_end ? (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600">
                        Cancels at period end
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-secondary/30 bg-secondary/10 text-secondary capitalize">
                        {subscription.status}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {currentPlan?.price ? `${currentPlan.price}/month excl. VAT` : ""}
                  </div>
                  {subscription.cancel_at_period_end ? (
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                      <div className="font-medium text-amber-700 dark:text-amber-400">
                        Access ends {formatDate(subscription.current_period_end)}
                      </div>
                      <div className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-400/80">
                        Your subscription is cancelled and will not renew. You'll keep full access until then. Resume anytime from the billing portal.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-muted-foreground">
                      Renews {formatDate(subscription.current_period_end)}
                    </div>
                  )}
                  {subscription.status === "past_due" && (
                    <div className="mt-2 text-xs text-amber-600">Payment failed — update your card to keep access.</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={openPortal} disabled={portalLoading} variant="outline" className="gap-2">
                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {subscription.cancel_at_period_end ? "Resume in portal" : "Manage billing"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Current plan</div>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="text-2xl font-semibold">No active plan</h2>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">Choose a plan below to activate your dashboard.</div>
              </div>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Available plans</h3>
          <p className="text-xs text-muted-foreground">All prices exclude VAT · VAT added at checkout</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {plans.map((p) => {
            const isCurrent = isActive && currentPlan?.name === p.name;
            return (
              <div
                key={p.name}
                className={`glass-card rounded-2xl p-5 flex flex-col ${p.highlight ? "ring-1 ring-secondary/40" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.name}</div>
                  {isCurrent && <Badge variant="outline" className="text-[10px]">Current</Badge>}
                  {p.highlight && !isCurrent && <Badge className="bg-secondary/20 text-secondary text-[10px]">Popular</Badge>}
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {p.price}<span className="text-sm font-normal text-muted-foreground">{p.price !== "Custom" ? "/mo excl. VAT" : ""}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                {p.enterprise ? (
                  <Button asChild variant="outline" className="mt-4">
                    <a href="/contact">Contact sales</a>
                  </Button>
                ) : isCurrent ? (
                  <Button disabled className="mt-4" variant="outline">Current plan</Button>
                ) : (
                  <Button
                    onClick={() => startUpgrade(p)}
                    className={`mt-4 ${p.highlight ? "bg-gradient-primary text-primary-foreground hover:opacity-90" : ""}`}
                    variant={p.highlight ? "default" : "outline"}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    {isActive ? "Switch plan" : "Choose plan"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment method + cancel via portal */}
        {isActive && (
          <div className="glass-card rounded-2xl p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Payment & cancellation</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Update your card, download receipts, or cancel your subscription in the Stripe customer portal.
                </div>
              </div>
              <Button onClick={openPortal} disabled={portalLoading} variant="outline" className="gap-2">
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Open portal
              </Button>
            </div>
          </div>
        )}

        {/* Invoices */}
        <div className="glass-card rounded-2xl p-6">
          <div className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">Invoices</div>
          {!isActive ? (
            <div className="text-sm text-muted-foreground">Invoices appear here once you have an active subscription.</div>
          ) : invoicesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-sm text-muted-foreground">No invoices yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{i.number ?? i.id}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(i.created)}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{formatCurrency(i.amount_paid, i.currency)}</span>
                    <Badge variant="outline" className="border-secondary/30 bg-secondary/10 text-secondary capitalize">
                      {i.status ?? "—"}
                    </Badge>
                    {i.hosted_invoice_url && (
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <a href={i.hosted_invoice_url} target="_blank" rel="noopener noreferrer" aria-label="View invoice">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Checkout overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-auto bg-background/95 backdrop-blur p-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={closeCheckout} className="gap-1"><X className="h-4 w-4" /> Close</Button>
            </div>
            {checkoutElement}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
