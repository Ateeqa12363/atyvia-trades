import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export type SubscriptionRow = {
  id: string;
  user_id: string | null;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  product_id: string | null;
  price_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string;
  updated_at: string;
};

export function isSubscriptionActive(sub: SubscriptionRow | null): boolean {
  if (!sub) return false;
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const future = end === null || end > Date.now();
  if (["active", "trialing", "past_due"].includes(sub.status) && future) return true;
  if (sub.status === "canceled" && end && end > Date.now()) return true;
  return false;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    let env: string;
    try {
      env = getStripeEnvironment();
    } catch {
      env = "sandbox";
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", uid)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as SubscriptionRow | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`subs:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => { void refetch(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, refetch]);

  // Payments temporarily disabled — always grant access so gated pages render.
  return {
    subscription,
    loading: false,
    isActive: true,
    refetch,
  };
}
