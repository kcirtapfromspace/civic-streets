import type { BillingState } from '@/lib/billing/types';

export function billingState(overrides: Partial<BillingState> = {}): BillingState {
  return {
    planKey: 'civic_free',
    interval: 'annual',
    status: 'none',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    billingEmail: null,
    customerPortalEnabled: false,
    organization: null,
    source: 'remote',
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
    ...overrides,
  };
}
