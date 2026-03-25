import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Badge } from '@/components/ui';
import { useBilling } from '@/lib/api/billing';
import {
  BILLING_PLANS,
  GOVERNMENT_PACKAGING_NOTES,
  WHAT_STAYS_FREE,
  getPlanByKey,
} from '@/lib/billing/plans';
import type { BillingFeatureKey } from '@/lib/billing/access';
import { useToast } from '@/components/ui/Toast';

export default function PricingPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const {
    billingState,
    billingStateLoading,
    isStartingCheckout,
    openPortal,
    startCheckout,
  } = useBilling();

  const currentPlan = useMemo(
    () => getPlanByKey(billingState.planKey),
    [billingState.planKey],
  );
  const requestedFeature = searchParams.get('feature') as
    | BillingFeatureKey
    | null;
  const requestedFeatureCopy = getFeatureUpsellCopy(requestedFeature);

  const handleTownCheckout = async () => {
    try {
      await startCheckout();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Unable to start checkout',
        'error',
      );
    }
  };

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

  const handleContactSales = (planName: string) => {
    window.location.href = `mailto:sales@curbwise.dev?subject=${encodeURIComponent(`Curbwise ${planName}`)}`;
  };

  return (
    <div className="min-h-full bg-slate-50">
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-14 lg:px-8">
          <div className="max-w-4xl space-y-5">
            <Badge className="bg-white/10 text-white border-white/15">
              Billing
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Free civic participation. Annual government plans for private work.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-300">
              Curbwise keeps the public-interest layer open, then prices private
              workspaces, internal review, and procurement-friendly delivery for
              towns, cities, and agencies that need to ship real projects.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/account">
                <Button variant="primary" className="bg-white text-slate-950 hover:bg-slate-100">
                  View Account
                </Button>
              </Link>
              <Link to="/institutions">
                <Button variant="secondary" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                  See Institutional Packaging
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Current Plan
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {billingStateLoading ? 'Loading billing state...' : currentPlan?.name ?? 'Civic Free'}
            </p>
            <p className="text-sm text-slate-600">
              {billingState.status === 'active'
                ? 'Your billing state is active.'
                : 'Public civic workflows remain available while you compare government plans.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => void handleManageBilling()}
              disabled={!billingState.customerPortalEnabled}
            >
              Manage Billing
            </Button>
            <Button
              variant="primary"
              onClick={() => handleContactSales('Institutional Pilot')}
            >
              Contact Sales
            </Button>
          </div>
        </div>

        {requestedFeatureCopy && (
          <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            <div>
              <p className="font-medium">{requestedFeatureCopy.title}</p>
              <p className="mt-1 text-amber-800">
                {requestedFeatureCopy.description}
              </p>
            </div>
            <Badge variant="warning">
              {requestedFeatureCopy.badge ?? 'Government Plan'}
            </Badge>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {BILLING_PLANS.map((plan) => {
            const isCurrent = billingState.planKey === plan.key;

            return (
              <article
                key={plan.key}
                className={`rounded-3xl border bg-white p-6 shadow-sm transition-transform ${
                  plan.featured
                    ? 'border-sky-300 ring-1 ring-sky-200 lg:-translate-y-1'
                    : 'border-slate-200'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {plan.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {plan.audience}
                      </p>
                    </div>
                    {plan.featured && <Badge variant="info">Recommended</Badge>}
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    {plan.tagline}
                  </p>
                </div>

                <div className="mt-6">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold tracking-tight text-slate-950">
                      {plan.annualPrice}
                    </span>
                    <span className="pb-1 text-sm text-slate-500">/ year</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{plan.annualNote}</p>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {plan.description}
                </p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm text-slate-700"
                    >
                      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {plan.key === 'civic_free' ? (
                    <Link to="/map">
                      <Button variant="secondary" className="w-full" disabled={isCurrent}>
                        {isCurrent ? 'Current Plan' : plan.ctaLabel}
                      </Button>
                    </Link>
                  ) : plan.ctaMode === 'self_serve' ? (
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => void handleTownCheckout()}
                      disabled={isStartingCheckout || isCurrent}
                    >
                      {isCurrent ? 'Current Plan' : plan.ctaLabel}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => handleContactSales(plan.name)}
                    >
                      {plan.ctaLabel}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              What Stays Free
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Civic participation should not depend on procurement.
            </h2>
            <div className="mt-6 space-y-3">
              {WHAT_STAYS_FREE.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    ✓
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Government Packaging
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Annual-first delivery for towns, cities, and agencies.
            </h2>
            <div className="mt-6 space-y-3">
              {GOVERNMENT_PACKAGING_NOTES.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                    →
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link to="/institutions">
                <Button variant="secondary">View Institutional Details</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function getFeatureUpsellCopy(feature: BillingFeatureKey | null) {
  switch (feature) {
    case 'pdf_export':
      return {
        title: 'Branded PDF export starts on Town Essential',
        description:
          'Move from public/watermarked civic export to branded concept packets for internal government work.',
        badge: 'Town Essential',
      };
    case 'premium_templates':
      return {
        title: 'Advanced templates are part of government plans',
        description:
          'Town Essential unlocks the advanced template library used for municipal concept work.',
        badge: 'Town Essential',
      };
    case 'private_projects':
      return {
        title: 'Private projects require a government workspace',
        description:
          'Town Essential unlocks private workspaces and private projects for smaller public agencies.',
        badge: 'Town Essential',
      };
    case 'report_pdf_attachment':
      return {
        title: 'Report attachments require branded export access',
        description:
          'Attach branded design artifacts to institutional report workflows on a government plan.',
        badge: 'Town Essential',
      };
    case 'team_collaboration':
    case 'review_threads':
      return {
        title: 'Internal review starts on the government plans',
        description:
          'Use Town Essential for basic review threads, or City Standard when you need multi-workspace collaboration.',
        badge: 'City Standard',
      };
    case 'approval_states':
      return {
        title: 'Approval states start on City Standard',
        description:
          'City Standard adds internal review states and approvals for municipal team delivery.',
        badge: 'City Standard',
      };
    case 'member_roles':
      return {
        title: 'Role-based access starts on City Standard',
        description:
          'City Standard introduces member roles for shared municipal workspaces.',
        badge: 'City Standard',
      };
    case 'audit_logs':
      return {
        title: 'Audit logs are part of Agency Enterprise',
        description:
          'Agency Enterprise is the procurement-ready tier for large agencies that need governance and auditability.',
        badge: 'Agency Enterprise',
      };
    default:
      return null;
  }
}
