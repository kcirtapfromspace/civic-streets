import { Link } from 'react-router-dom';
import { Button, Badge } from '@/components/ui';
import { useBilling } from '@/lib/api/billing';
import { useToast } from '@/components/ui/Toast';
import { hasActiveBillingStatus } from '@/lib/billing/access';
import { BILLING_PLANS, getPlanByKey } from '@/lib/billing/plans';

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AccountPage() {
  const { showToast } = useToast();
  const {
    billingState,
    billingStateLoading,
    billingError,
    billingState: { entitlements },
    openPortal,
    startCheckout,
  } = useBilling();

  const currentPlan = getPlanByKey(billingState.planKey);
  const hasLivePaidPlan =
    billingState.planKey === 'enterprise' ||
    ((billingState.planKey === 'pro' || billingState.planKey === 'team') &&
      hasActiveBillingStatus(billingState.status));
  const currentPlanName =
    billingState.planKey === 'enterprise'
      ? 'Enterprise'
      : currentPlan?.name ?? 'Free';
  const billingStatusCopy = getBillingStatusCopy(billingState.status);

  const handleManageBilling = async () => {
    try {
      await openPortal();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Unable to open billing portal',
        'error',
      );
    }
  };

  const handleUpgrade = async () => {
    try {
      await startCheckout('pro', billingState.interval);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Unable to start upgrade',
        'error',
      );
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Account
            </p>
            <h1 className="text-3xl font-semibold text-slate-950">
              Billing and workspace status
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Manage your plan, open the Stripe portal, and see which features are unlocked right now.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/pricing">
              <Button variant="secondary">View Pricing</Button>
            </Link>
            {billingState.customerPortalEnabled ? (
              <Button variant="primary" onClick={() => void handleManageBilling()}>
                Manage Billing
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void handleUpgrade()}>
                Upgrade to Pro
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                  Current Plan
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {billingStateLoading ? 'Loading...' : currentPlanName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {billingStatusCopy}
                </p>
              </div>
              <Badge variant={hasLivePaidPlan ? 'success' : 'default'}>
                {billingState.status}
              </Badge>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                  Renewal
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {formatDate(billingState.currentPeriodEnd)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {billingState.cancelAtPeriodEnd
                    ? 'Set to cancel at period end'
                    : 'Auto-renewing'}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                  Billing Email
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {billingState.billingEmail ?? 'Not available yet'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Managed through Stripe Checkout or Portal
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Account access
                  </p>
                  <p className="text-sm text-slate-500">
                    Billing state is projected into Convex so feature gates stay server-side.
                  </p>
                </div>
                {billingError && (
                  <Badge variant="warning">Billing backend not synced</Badge>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Unlocks
              </p>
              <div className="mt-4 space-y-3">
                {BILLING_PLANS.find((plan) => plan.key === 'pro')?.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Entitlements
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Private projects</span>
                  <Badge variant={entitlements.privateProjects ? 'success' : 'default'}>
                    {entitlements.privateProjects ? 'On' : 'Off'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Branded exports</span>
                  <Badge variant={entitlements.brandedExports ? 'success' : 'default'}>
                    {entitlements.brandedExports ? 'On' : 'Off'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Team collaboration</span>
                  <Badge variant={entitlements.teamCollaboration ? 'success' : 'default'}>
                    {entitlements.teamCollaboration ? 'On' : 'Off'}
                  </Badge>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/">
            <Button variant="secondary">Back to Map</Button>
          </Link>
          <Link to="/pricing">
            <Button variant="ghost">See all plans</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function getBillingStatusCopy(status: ReturnType<typeof useBilling>['billingState']['status']): string {
  if (status === 'active' || status === 'trialing') {
    return 'Subscription active';
  }
  if (status === 'pending') {
    return 'Checkout started. Waiting for Stripe to confirm the subscription.';
  }
  if (status === 'past_due') {
    return 'Payment issue detected. Update billing details in Stripe.';
  }
  if (status === 'canceled') {
    return 'Subscription canceled';
  }
  return 'No active paid subscription yet';
}
