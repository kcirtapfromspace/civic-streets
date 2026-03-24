import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Badge } from '@/components/ui';
import { useBilling } from '@/lib/api/billing';
import {
  BILLING_PLANS,
  ENTERPRISE_BILLING,
  getBillingIntervalLabel,
} from '@/lib/billing/plans';
import type { BillingInterval, BillingPlanKey } from '@/lib/billing/types';
import { useToast } from '@/components/ui/Toast';
import type { BillingFeatureKey } from '@/lib/billing/access';

function intervalPriceLabel(
  planKey: BillingPlanKey,
  interval: BillingInterval,
): string {
  const plan = BILLING_PLANS.find((item) => item.key === planKey);
  if (!plan) return '$0';
  return interval === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
}

function IntervalToggle({
  interval,
  setInterval,
}: {
  interval: BillingInterval;
  setInterval: (interval: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200">
      {(['monthly', 'annual'] as BillingInterval[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setInterval(option)}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            interval === option
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {getBillingIntervalLabel(option)}
        </button>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
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
    () => BILLING_PLANS.find((plan) => plan.key === billingState.planKey),
    [billingState.planKey],
  );
  const currentPlanName =
    billingState.planKey === 'enterprise'
      ? 'Enterprise'
      : currentPlan?.name ?? 'Free';
  const requestedFeature = searchParams.get('feature') as
    | BillingFeatureKey
    | null;
  const requestedFeatureCopy = getFeatureUpsellCopy(requestedFeature);

  const handleCheckout = async (
    planKey: Exclude<BillingPlanKey, 'free' | 'enterprise'>,
  ) => {
    try {
      await startCheckout(planKey, interval);
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

  const handleEnterprise = () => {
    window.location.href = 'mailto:sales@curbwise.dev?subject=Curbwise%20Enterprise%20Pricing';
  };

  return (
    <div className="min-h-full bg-slate-50">
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-14 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <Badge className="bg-white/10 text-white border-white/15">
              Billing
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Pricing built around finished street concepts, not seat filler.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300">
              Curbwise is priced around the deliverable that matters: credible,
              standards-aware street work that can go straight into a meeting,
              memo, or grant packet.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/account">
                <Button variant="primary" className="bg-white text-slate-950 hover:bg-slate-100">
                  View Account
                </Button>
              </Link>
              <a href="#plans">
                <Button variant="secondary" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                  Compare Plans
                </Button>
              </a>
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
              {billingStateLoading ? 'Loading billing state...' : currentPlanName}
            </p>
            <p className="text-sm text-slate-600">
              {billingState.status === 'active'
                ? 'Your subscription is active.'
                : 'You can upgrade, compare, or manage billing from here.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <IntervalToggle interval={interval} setInterval={setInterval} />
            <Button
              variant="secondary"
              onClick={() => void handleManageBilling()}
              disabled={!billingState.customerPortalEnabled}
            >
              Manage Billing
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
            <Badge variant="warning">Pro</Badge>
          </div>
        )}

        <div id="plans" className="grid gap-5 lg:grid-cols-3">
          {BILLING_PLANS.map((plan) => {
            const isCurrent = billingState.planKey === plan.key;
            const price = intervalPriceLabel(plan.key, interval);

            return (
              <article
                key={plan.key}
                className={`rounded-3xl border bg-white p-6 shadow-sm transition-transform ${
                  plan.featured
                    ? 'border-sky-300 ring-1 ring-sky-200 lg:-translate-y-1'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
                  </div>
                  {plan.featured && (
                    <Badge variant="info">Most Popular</Badge>
                  )}
                </div>

                <div className="mt-6">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold tracking-tight text-slate-950">
                      {price}
                    </span>
                    <span className="pb-1 text-sm text-slate-500">
                      / {interval}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{plan.annualNote}</p>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {plan.description}
                </p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {plan.key === 'free' ? (
                    <Link to="/account">
                      <Button variant="secondary" className="w-full" disabled={isCurrent}>
                        {isCurrent ? 'Current Plan' : plan.ctaLabel}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant={plan.featured ? 'primary' : 'secondary'}
                      className="w-full"
                      onClick={() =>
                        void handleCheckout(
                          plan.key as Exclude<
                            BillingPlanKey,
                            'free' | 'enterprise'
                          >,
                        )
                      }
                      disabled={isStartingCheckout || isCurrent}
                    >
                      {isCurrent ? 'Current Plan' : plan.ctaLabel}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Enterprise
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {ENTERPRISE_BILLING.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {ENTERPRISE_BILLING.tagline}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {ENTERPRISE_BILLING.description}
              </p>
            </div>
            <Button variant="secondary" onClick={handleEnterprise}>
              {ENTERPRISE_BILLING.ctaLabel}
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ENTERPRISE_BILLING.features.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                {feature}
              </div>
            ))}
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
        title: 'PDF export is a Pro feature',
        description:
          'Upgrade to unlock unwatermarked concept PDFs for meetings, memos, and grant packets.',
      };
    case 'premium_templates':
      return {
        title: 'Advanced templates are included in Pro',
        description:
          'Unlock premium transit and shared-space templates designed for client-ready concept work.',
      };
    case 'private_projects':
      return {
        title: 'Private projects require Pro',
        description:
          'Upgrade to keep design work private while you iterate before sharing publicly.',
      };
    case 'report_pdf_attachment':
      return {
        title: 'Report attachments require Pro',
        description:
          'Attach street design PDFs to outreach flows once you are on the Pro plan.',
      };
    case 'team_collaboration':
      return {
        title: 'Team collaboration starts on Team',
        description:
          'Upgrade when you need shared access, branded deliverables, and coordinated billing.',
      };
    default:
      return null;
  }
}
