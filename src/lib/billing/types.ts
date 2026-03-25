export type BillingPlanKey =
  | 'civic_free'
  | 'town_essential'
  | 'city_standard'
  | 'agency_enterprise';
export type BillingInterval = 'monthly' | 'annual';

export type BillingStatus =
  | 'none'
  | 'inactive'
  | 'pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid';

export interface BillingEntitlements {
  publicHotspots: boolean;
  publicIssueReports: boolean;
  publicProposals: boolean;
  publicShareLinks: boolean;
  basicPublicExports: boolean;
  privateWorkspaces: boolean;
  privateProjects: boolean;
  brandedExports: boolean;
  advancedTemplates: boolean;
  reviewThreads: boolean;
  approvalStates: boolean;
  memberRoles: boolean;
  billingAdmin: boolean;
  invoiceMode: boolean;
  auditLogs: boolean;
  sso: boolean;
  customOverlays: boolean;
  retentionControls: boolean;
  prioritySupport: boolean;
}

export interface BillingOrganizationSummary {
  organizationId: string;
  organizationType: string | null;
  jurisdictionName: string | null;
  populationBand: string | null;
  contractTier: string | null;
  procurementState: string | null;
  invoiceMode: string | null;
  purchaseOrderNumber: string | null;
  contractRenewalDate: string | null;
}

export interface BillingState {
  planKey: BillingPlanKey;
  interval: BillingInterval;
  status: BillingStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingEmail: string | null;
  customerPortalEnabled: boolean;
  entitlements: BillingEntitlements;
  organization: BillingOrganizationSummary | null;
  source: 'remote' | 'local';
  message?: string | null;
}

export interface BillingCheckoutArgs {
  sessionToken: string;
  planKey: 'town_essential';
  interval: 'year';
  successUrl: string;
  cancelUrl: string;
}

export interface BillingCheckoutResult {
  url?: string;
  redirectUrl?: string;
  sessionUrl?: string;
  checkoutUrl?: string;
}

export interface BillingPortalArgs {
  sessionToken: string;
  returnUrl: string;
}

export interface BillingPortalResult {
  url?: string;
  redirectUrl?: string;
  portalUrl?: string;
}
