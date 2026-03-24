import type { BillingInterval, BillingPlanKey } from './types';

export interface BillingPlan {
  key: BillingPlanKey;
  name: string;
  tagline: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  annualNote: string;
  features: string[];
  ctaLabel: string;
  featured?: boolean;
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: 'free',
    name: 'Free',
    tagline: 'For public-interest work and evaluation.',
    description:
      'Try the map, editor, and community workflows before you need a paid workspace.',
    monthlyPrice: '$0',
    annualPrice: '$0',
    annualNote: 'No card required',
    features: [
      'Public projects',
      'Limited exports',
      'Community hotspots',
      'Basic templates',
    ],
    ctaLabel: 'Stay Free',
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'For consultants and small planning teams.',
    description:
      'Private projects, branded exports, and enough throughput to use Curbwise on active client work.',
    monthlyPrice: '$99',
    annualPrice: '$990',
    annualNote: '2 months free billed annually',
    features: [
      'Private projects',
      'Unwatermarked PDF exports',
      'Advanced templates',
      'Priority billing support',
    ],
    ctaLabel: 'Start Pro',
    featured: true,
  },
  {
    key: 'team',
    name: 'Team',
    tagline: 'For agencies and shared delivery.',
    description:
      'Collaborative billing for teams that need shared work, review loops, and more control over deliverables.',
    monthlyPrice: '$299',
    annualPrice: '$2,990',
    annualNote: 'Annual invoice-friendly pricing',
    features: [
      'Team collaboration',
      'Custom templates',
      'Branded export packages',
      'Shared account management',
    ],
    ctaLabel: 'Start Team',
  },
];

export const ENTERPRISE_BILLING = {
  key: 'enterprise' as const,
  name: 'Enterprise',
  tagline: 'For cities, BIDs, and larger public agencies.',
  description:
    'Procurement-friendly billing with SSO, custom overlays, and implementation support.',
  features: [
    'SSO and shared workspaces',
    'Custom city overlays',
    'Dedicated onboarding',
    'Annual contracts and invoicing',
  ],
  ctaLabel: 'Contact Sales',
};

export function getBillingIntervalLabel(interval: BillingInterval): string {
  return interval === 'monthly' ? 'Monthly' : 'Annual';
}

export function getPlanByKey(key: BillingPlanKey): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.key === key);
}
