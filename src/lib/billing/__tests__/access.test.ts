import { describe, expect, it } from 'vitest';
import {
  canAccessBillingFeature,
  hasActiveBillingStatus,
} from '@/lib/billing/access';
import type { BillingState } from '@/lib/billing/types';

function createBillingState(overrides: Partial<BillingState> = {}): BillingState {
  return {
    planKey: 'civic_free',
    interval: 'annual',
    status: 'none',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    billingEmail: null,
    customerPortalEnabled: false,
    organization: null,
    entitlements: {
      publicHotspots: true,
      publicIssueReports: true,
      publicProposals: true,
      publicShareLinks: true,
      basicPublicExports: true,
      privateWorkspaces: false,
      privateProjects: false,
      brandedExports: false,
      advancedTemplates: false,
      reviewThreads: false,
      approvalStates: false,
      memberRoles: false,
      billingAdmin: false,
      invoiceMode: false,
      auditLogs: false,
      sso: false,
      customOverlays: false,
      retentionControls: false,
      prioritySupport: false,
    },
    source: 'local',
    message: null,
    ...overrides,
  };
}

describe('billing access', () => {
  it('keeps municipal features locked while checkout is pending', () => {
    const billingState = createBillingState({
      planKey: 'town_essential',
      status: 'pending',
      entitlements: {
        ...createBillingState().entitlements,
        privateWorkspaces: true,
        privateProjects: true,
        brandedExports: true,
        advancedTemplates: true,
        reviewThreads: true,
      },
    });

    expect(canAccessBillingFeature(billingState, 'private_projects')).toBe(false);
    expect(canAccessBillingFeature(billingState, 'pdf_export')).toBe(false);
  });

  it('unlocks town features for active subscriptions', () => {
    const billingState = createBillingState({
      planKey: 'town_essential',
      status: 'active',
      entitlements: {
        ...createBillingState().entitlements,
        privateWorkspaces: true,
        privateProjects: true,
        brandedExports: true,
        advancedTemplates: true,
        reviewThreads: true,
      },
    });

    expect(canAccessBillingFeature(billingState, 'private_projects')).toBe(true);
    expect(canAccessBillingFeature(billingState, 'pdf_export')).toBe(true);
    expect(canAccessBillingFeature(billingState, 'team_collaboration')).toBe(false);
  });

  it('requires city standard for collaboration controls', () => {
    const billingState = createBillingState({
      planKey: 'city_standard',
      status: 'active',
      entitlements: {
        ...createBillingState().entitlements,
        privateWorkspaces: true,
        privateProjects: true,
        brandedExports: true,
        advancedTemplates: true,
        reviewThreads: true,
        approvalStates: true,
        memberRoles: true,
      },
    });

    expect(canAccessBillingFeature(billingState, 'team_collaboration')).toBe(true);
    expect(canAccessBillingFeature(billingState, 'approval_states')).toBe(true);
  });

  it('treats only active and trialing statuses as live access', () => {
    expect(hasActiveBillingStatus('active')).toBe(true);
    expect(hasActiveBillingStatus('trialing')).toBe(true);
    expect(hasActiveBillingStatus('pending')).toBe(false);
    expect(hasActiveBillingStatus('past_due')).toBe(false);
    expect(hasActiveBillingStatus('canceled')).toBe(false);
  });
});
