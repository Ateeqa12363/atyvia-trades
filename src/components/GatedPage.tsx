import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Paywall } from "@/components/Paywall";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Wraps a protected page: still renders inside AppLayout so the shell is
 * visible, but shows a Paywall instead of the page body until the user has
 * an active subscription.
 */
export function GatedPage({ children, featureName }: { children: ReactNode; featureName?: string }) {
  const { isActive, loading } = useSubscription();
  return (
    <AppLayout>
      {loading ? (
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : isActive ? (
        children
      ) : (
        <Paywall featureName={featureName} />
      )}
    </AppLayout>
  );
}
