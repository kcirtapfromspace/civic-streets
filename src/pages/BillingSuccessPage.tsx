import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useBilling } from '@/lib/api/billing';

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const { billingState, billingStateLoading, refreshBillingState } = useBilling();

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshBillingState();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [refreshBillingState]);

  useEffect(() => {
    if (billingStateLoading) return;
    if (billingState.planKey !== 'free') {
      const timer = window.setTimeout(() => {
        navigate('/account');
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [billingStateLoading, billingState.planKey, navigate]);

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          ✓
        </div>
        <h1 className="text-2xl font-semibold text-slate-950">
          Payment received
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          We are syncing your subscription and entitlements now. This page
          will automatically forward you to your account once Stripe webhooks
          finish updating Convex.
        </p>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
            Current status
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {billingStateLoading ? 'Refreshing billing state...' : billingState.planKey}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={() => navigate('/account')}>
            Go to Account
          </Button>
          <Link to="/">
            <Button variant="secondary">Back to Map</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
