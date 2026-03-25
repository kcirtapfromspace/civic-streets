import type { BillingInterval, BillingPlanKey } from './types';

export interface BillingPlan {
  key: BillingPlanKey;
  name: string;
  audience: string;
  tagline: string;
  description: string;
  annualPrice: string;
  annualNote: string;
  features: string[];
  ctaLabel: string;
  ctaMode: 'self_serve' | 'contact' | 'current';
  featured?: boolean;
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: 'civic_free',
    name: 'Civic Free',
    audience: 'Residents, advocates, journalists, and public-interest work',
    tagline: 'Keep the public-interest layer open and usable.',
    description:
      'Public hotspots, issue reporting, read-only sharing, and public proposal work stay free so civic participation does not depend on procurement.',
    annualPrice: '$0',
    annualNote: 'No card required',
    features: [
      'Public hotspots and issue reporting',
      'Public proposals and read-only share links',
      'Basic/watermarked public exports',
      'Core civic reporting workflows',
    ],
    ctaLabel: 'Keep Using Civic Free',
    ctaMode: 'current',
  },
  {
    key: 'town_essential',
    name: 'Town Essential',
    audience: 'Towns and small cities under 50k population',
    tagline: 'Affordable annual access for smaller public agencies.',
    description:
      'One private workspace, up to five members, branded exports, review threads, and a simple annual self-serve path for smaller public bodies.',
    annualPrice: '$3,000',
    annualNote: 'Annual self-serve pricing',
    features: [
      '1 private workspace and up to 5 members',
      'Private projects and branded exports',
      'Advanced templates and review threads',
      'Annual billing with light onboarding',
    ],
    ctaLabel: 'Start Town Essential',
    ctaMode: 'self_serve',
    featured: true,
  },
  {
    key: 'city_standard',
    name: 'City Standard',
    audience: 'Cities 50k-500k and smaller public agencies',
    tagline: 'Collaborative municipal delivery with annual contracts.',
    description:
      'Multiple workspaces, member roles, approvals, template controls, and procurement-lite annual invoicing for city teams that need shared delivery.',
    annualPrice: '$12,000',
    annualNote: 'Annual contract, provisioned with onboarding',
    features: [
      'Multiple workspaces and member roles',
      'Approval states and internal reviews',
      'Template library controls',
      'Annual invoicing and onboarding support',
    ],
    ctaLabel: 'Talk to Sales',
    ctaMode: 'contact',
  },
  {
    key: 'agency_enterprise',
    name: 'Agency Enterprise',
    audience: 'Large cities, regional agencies, and transit authorities',
    tagline: 'Procurement-ready delivery for annual institutional contracts.',
    description:
      'Manual institutional pilots today, with dedicated onboarding and org controls for large agencies that need annual terms, procurement support, and advanced governance.',
    annualPrice: '$35,000+',
    annualNote: 'Annual contract, scoped with procurement review',
    features: [
      'Audit logs and billing admin controls',
      'Custom overlays and retention controls',
      'Implementation support for pilot rollouts',
      'Manual institutional provisioning',
    ],
    ctaLabel: 'Plan an Institutional Pilot',
    ctaMode: 'contact',
  },
];

export const WHAT_STAYS_FREE = [
  'Public hotspots and issue reporting',
  'Public proposals and read-only sharing',
  'Basic public exports for civic advocacy',
  'Community-facing safety storytelling',
];

export const GOVERNMENT_PACKAGING_NOTES = [
  'Population bands determine municipal pricing, not seat count alone.',
  'Only Town Essential is self-serve in Stripe.',
  'City Standard and Agency Enterprise are annual, sales-led contracts.',
  'Institutional pilots are provisioned manually until enterprise controls are complete.',
];

export function getBillingIntervalLabel(interval: BillingInterval): string {
  return interval === 'monthly' ? 'Monthly' : 'Annual';
}

export function getPlanByKey(key: BillingPlanKey): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.key === key);
}
