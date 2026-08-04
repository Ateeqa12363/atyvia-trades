import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { getCheckoutSessionStatus } from '@/lib/payments.functions';
import { getStripeEnvironment } from '@/lib/stripe';

export const Route = createFileRoute('/checkout/return')({
  head: () => ({ meta: [{ title: 'Payment complete — Atyvia' }] }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

type Status = { loading: true } | { loading: false; ok: boolean; message: string; plan?: string | null };

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const [state, setState] = useState<Status>({ loading: true });

  useEffect(() => {
    if (!session_id) {
      setState({ loading: false, ok: false, message: 'No session information found.' });
      return;
    }
    (async () => {
      const res = await getCheckoutSessionStatus({
        data: { sessionId: session_id, environment: getStripeEnvironment() },
      });
      if ('error' in res) {
        setState({ loading: false, ok: false, message: res.error });
        return;
      }
      const paid = res.payment_status === 'paid' || res.payment_status === 'no_payment_required';
      if (paid || res.status === 'complete') {
        setState({ loading: false, ok: true, message: 'Your subscription is active.', plan: res.plan_name });
      } else if (res.status === 'open') {
        setState({ loading: false, ok: false, message: 'Payment not completed. Please try again.' });
      } else {
        setState({ loading: false, ok: false, message: `Status: ${res.status ?? 'unknown'}` });
      }
    })();
  }, [session_id]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg py-12">
        <div className="glass-card rounded-2xl p-8 text-center">
          {state.loading ? (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">Confirming payment…</h1>
            </>
          ) : state.ok ? (
            <>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-secondary/15">
                <CheckCircle2 className="h-7 w-7 text-secondary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Payment complete</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.plan ? `${state.plan} is now active.` : state.message}
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/15">
                <XCircle className="h-7 w-7 text-destructive" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Payment not confirmed</h1>
              <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            </>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild><Link to="/billing">Back to billing</Link></Button>
            <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
