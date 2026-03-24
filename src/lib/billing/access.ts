import { useMemo } from 'react';
import { useBilling } from '@/lib/api/billing';
import type {
  BillingEntitlements,
  BillingPlanKey,
  BillingState,
} from './types';

export type BillingFeatureKey =
  | 'private_projects'
  | 'pdf_export'
  | 'premium_templates'
  | 'report_pdf_attachment'
  | 'team_collaboration';

type BillingAccessRequirement = {
  minimumPlan: BillingPlanKey;
  entitlement?: keyof BillingEntitlements;
};

const PLAN_ORDER: Record<BillingPlanKey, number> = {
  free: 0,
  pro: 1,
  team: 2,
  enterprise: 3,
};

const BILLING_ACCESS_REQUIREMENTS: Record<
  BillingFeatureKey,
  BillingAccessRequirement
> = {
  private_projects: {
    minimumPlan: 'pro',
    entitlement: 'privateProjects',
  },
  pdf_export: {
    minimumPlan: 'pro',
    entitlement: 'unwatermarkedExports',
  },
  premium_templates: {
    minimumPlan: 'pro',
    entitlement: 'advancedTemplates',
  },
  report_pdf_attachment: {
    minimumPlan: 'pro',
    entitlement: 'unwatermarkedExports',
  },
  team_collaboration: {
    minimumPlan: 'team',
    entitlement: 'teamCollaboration',
  },
};

function getPlanRank(planKey: BillingPlanKey): number {
  return PLAN_ORDER[planKey] ?? 0;
}

function hasPlanAccess(
  currentPlan: BillingPlanKey,
  minimumPlan: BillingPlanKey,
): boolean {
  return getPlanRank(currentPlan) >= getPlanRank(minimumPlan);
}

function hasEntitlement(
  entitlements: BillingEntitlements,
  entitlement?: keyof BillingEntitlements,
): boolean {
  if (!entitlement) return true;
  return entitlements[entitlement] === true;
}

export function hasActiveBillingStatus(status: BillingState['status']): boolean {
  return status === 'active' || status === 'trialing';
}

export function getPricingHref(feature?: BillingFeatureKey): string {
  if (!feature) return '/pricing';
  return `/pricing?feature=${encodeURIComponent(feature)}`;
}

export function canAccessBillingFeature(
  billingState: BillingState,
  feature: BillingFeatureKey,
): boolean {
  const requirement = BILLING_ACCESS_REQUIREMENTS[feature];
  if (billingState.planKey === 'enterprise') return true;
  if (!hasPlanAccess(billingState.planKey, requirement.minimumPlan)) {
    return false;
  }
  if (!hasActiveBillingStatus(billingState.status)) {
    return false;
  }
  return hasEntitlement(billingState.entitlements, requirement.entitlement);
}

export function useBillingAccess(feature: BillingFeatureKey) {
  const { billingState, billingStateLoading } = useBilling();

  const canAccess = useMemo(
    () => canAccessBillingFeature(billingState, feature),
    [billingState, feature],
  );

  const pricingHref = useMemo(() => getPricingHref(feature), [feature]);

  return {
    billingState,
    billingStateLoading,
    canAccess: billingStateLoading ? false : canAccess,
    pricingHref,
    requiredPlanKey: BILLING_ACCESS_REQUIREMENTS[feature].minimumPlan,
    requiredEntitlement: BILLING_ACCESS_REQUIREMENTS[feature].entitlement,
  };
}
