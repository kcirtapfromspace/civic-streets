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
  | 'review_threads'
  | 'approval_states'
  | 'member_roles'
  | 'audit_logs'
  | 'team_collaboration';

type BillingAccessRequirement = {
  minimumPlan: BillingPlanKey;
  entitlement?: keyof BillingEntitlements;
};

export const BILLING_FEATURE_LABELS: Record<BillingFeatureKey, string> = {
  private_projects: 'private projects',
  pdf_export: 'branded PDF exports',
  premium_templates: 'advanced template packs',
  report_pdf_attachment: 'report PDF attachments',
  review_threads: 'review threads',
  approval_states: 'approval states',
  member_roles: 'member roles',
  audit_logs: 'audit logs',
  team_collaboration: 'shared municipal collaboration',
};

const PLAN_ORDER: Record<BillingPlanKey, number> = {
  civic_free: 0,
  town_essential: 1,
  city_standard: 2,
  agency_enterprise: 3,
};

const BILLING_ACCESS_REQUIREMENTS: Record<
  BillingFeatureKey,
  BillingAccessRequirement
> = {
  private_projects: {
    minimumPlan: 'town_essential',
    entitlement: 'privateProjects',
  },
  pdf_export: {
    minimumPlan: 'town_essential',
    entitlement: 'brandedExports',
  },
  premium_templates: {
    minimumPlan: 'town_essential',
    entitlement: 'advancedTemplates',
  },
  report_pdf_attachment: {
    minimumPlan: 'town_essential',
    entitlement: 'brandedExports',
  },
  review_threads: {
    minimumPlan: 'town_essential',
    entitlement: 'reviewThreads',
  },
  approval_states: {
    minimumPlan: 'city_standard',
    entitlement: 'approvalStates',
  },
  member_roles: {
    minimumPlan: 'city_standard',
    entitlement: 'memberRoles',
  },
  audit_logs: {
    minimumPlan: 'agency_enterprise',
    entitlement: 'auditLogs',
  },
  team_collaboration: {
    minimumPlan: 'city_standard',
    entitlement: 'reviewThreads',
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

export function getGovernmentContactHref(feature?: BillingFeatureKey): string {
  if (!feature) {
    return '/account?intent=government';
  }
  return `/account?intent=government&feature=${encodeURIComponent(feature)}`;
}

export function canAccessBillingFeature(
  billingState: BillingState,
  feature: BillingFeatureKey,
): boolean {
  const requirement = BILLING_ACCESS_REQUIREMENTS[feature];
  if (billingState.planKey === 'agency_enterprise') return true;
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

  const contactHref = useMemo(
    () => getGovernmentContactHref(feature),
    [feature],
  );

  return {
    billingState,
    billingStateLoading,
    canAccess: billingStateLoading ? false : canAccess,
    contactHref,
    requestedFeatureLabel: BILLING_FEATURE_LABELS[feature],
    requiredPlanKey: BILLING_ACCESS_REQUIREMENTS[feature].minimumPlan,
    requiredEntitlement: BILLING_ACCESS_REQUIREMENTS[feature].entitlement,
  };
}
