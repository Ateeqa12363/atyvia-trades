import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string; alreadySubscribed?: boolean } | { error: string };
type PortalSessionResult = { url: string } | { error: string };
type InvoicesResult =
  | {
      invoices: Array<{
        id: string;
        number: string | null;
        created: number;
        amount_paid: number;
        currency: string;
        status: string | null;
        hosted_invoice_url: string | null;
        invoice_pdf: string | null;
      }>;
    }
  | { error: string };
type SessionStatusResult =
  | {
      status: string | null;
      payment_status: string | null;
      customer_email: string | null;
      plan_name: string | null;
    }
  | { error: string };

// Look up an existing Customer by userId metadata, then by email, or create one.
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const { userId, supabase } = context;
      const { data: userRes } = await supabase.auth.getUser();
      const email = userRes.user?.email ?? undefined;

      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) return { error: "Price not found" };
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      // Prevent duplicate active subscription for the same price
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("status, price_id, current_period_end")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .eq("price_id", data.priceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSub) {
        const end = existingSub.current_period_end ? new Date(existingSub.current_period_end).getTime() : null;
        const isFuture = !end || end > Date.now();
        const active = ["active", "trialing", "past_due"].includes(existingSub.status) && isFuture;
        if (active) {
          return { clientSecret: "", alreadySubscribed: true };
        }
      }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
        managed_payments: { enabled: true },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("createCheckoutSession error", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const { userId, supabase } = context;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) return { error: "No subscription found" };

      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (error) {
      console.error("createPortalSession error", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<InvoicesResult> => {
    try {
      const { userId, supabase } = context;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) return { invoices: [] };

      const stripe = createStripeClient(data.environment);
      const list = await stripe.invoices.list({ customer: sub.stripe_customer_id, limit: 24 });
      return {
        invoices: list.data.map((i) => ({
          id: i.id ?? "",
          number: i.number ?? null,
          created: i.created,
          amount_paid: i.amount_paid,
          currency: i.currency,
          status: i.status ?? null,
          hosted_invoice_url: i.hosted_invoice_url ?? null,
          invoice_pdf: i.invoice_pdf ?? null,
        })),
      };
    } catch (error) {
      console.error("listInvoices error", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getCheckoutSessionStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.sessionId)) throw new Error("Invalid sessionId");
    return data;
  })
  .handler(async ({ data }): Promise<SessionStatusResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price.product"],
      });
      const lineItem = session.line_items?.data?.[0];
      const price = lineItem?.price as { product?: { name?: string } | string } | undefined;
      const product = price && typeof price.product === "object" ? price.product : null;
      return {
        status: session.status ?? null,
        payment_status: session.payment_status ?? null,
        customer_email: session.customer_details?.email ?? null,
        plan_name: product?.name ?? null,
      };
    } catch (error) {
      console.error("getCheckoutSessionStatus error", error);
      return { error: getStripeErrorMessage(error) };
    }
  });
