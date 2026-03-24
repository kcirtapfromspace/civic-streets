export type BillingPlanKey = 'free' | 'pro' | 'team' | 'enterprise';
export type BillingInterval = 'monthly' | 'annual';

export type BillingStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid';

export interface BillingEntitlements {
  privateProjects: boolean;
  brandedExports: boolean;
  unwatermarkedExports: boolean;
  advancedTemplates: boolean;
  teamCollaboration: boolean;
  customTemplates: boolean;
  prioritySupport: boolean;
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
  source: 'remote' | 'local';
  message?: string | null;
}

export interface BillingCheckoutArgs {
  sessionToken: string;
  planKey: Exclude<BillingPlanKey, 'free' | 'enterprise'>;
  interval: 'month' | 'year';
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
