import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

function priceIdFrom(item: any): string | null {
  return (
    item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id || null
  );
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = priceIdFrom(item);
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  // Read userId (subscription.metadata first, then fall back to the Customer's metadata)
  let userId: string | null = subscription.metadata?.userId ?? null;
  let email: string | null = null;
  try {
    const customerId = subscription.customer;
    if (customerId) {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(env);
      const customer: any = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted) {
        email = customer.email ?? null;
        if (!userId) userId = customer.metadata?.userId ?? null;
      }
    }
  } catch (e) {
    console.error("Failed to fetch customer", e);
  }

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        customer_email: email,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        product_id: productId,
        price_id: priceId,
        status: subscription.status,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as {
        metadata?: { invoiceId?: string };
      };
      if (session.metadata?.invoiceId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("invoices")
          .update({
            status: "paid",
            paid_at: now,
          })
          .eq("id", session.metadata.invoiceId);
        if (error) {
          console.error("[stripe-webhook] failed to mark invoice as paid", error);
        } else {
          console.log("[stripe-webhook] marked invoice as paid", session.metadata.invoiceId);
        }
      }
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook: invalid env", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
