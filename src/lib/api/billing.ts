import { useCallback, useEffect, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from './auth';
import type {
  BillingCheckoutResult,
  BillingEntitlements,
  BillingPortalResult,
  BillingState,
} from '@/lib/billing/types';

const LOCAL_ENTITLEMENTS: BillingEntitlements = {
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
};

const LOCAL_BILLING_STATE: BillingState = {
  planKey: 'civic_free',
  interval: 'annual',
  status: 'none',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  billingEmail: null,
  customerPortalEnabled: false,
  entitlements: LOCAL_ENTITLEMENTS,
  organization: null,
  source: 'local',
  message: null,
};

function getAppOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function toIsoStringFromTimestamp(value: number): string {
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  return new Date(milliseconds).toISOString();
}

function resolveUrl(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return null;

  const candidate = result as {
    url?: unknown;
    redirectUrl?: unknown;
    sessionUrl?: unknown;
    checkoutUrl?: unknown;
    portalUrl?: unknown;
  };

  const url =
    candidate.url ??
    candidate.redirectUrl ??
    candidate.sessionUrl ??
    candidate.checkoutUrl ??
    candidate.portalUrl;

  return typeof url === 'string' ? url : null;
}

function normalizePlanKey(value: unknown): BillingState['planKey'] {
  if (value === 'town_essential' || value === 'pro') {
    return 'town_essential';
  }
  if (value === 'city_standard' || value === 'team') {
    return 'city_standard';
  }
  if (value === 'agency_enterprise' || value === 'enterprise') {
    return 'agency_enterprise';
  }
  return 'civic_free';
}

function normalizeEntitlements(value: unknown): BillingEntitlements {
  if (!value || typeof value !== 'object') {
    return LOCAL_ENTITLEMENTS;
  }

  const raw = value as Partial<Record<string, unknown>>;
  return {
    publicHotspots:
      raw.publicHotspots === true || raw.public_hotspots === true,
    publicIssueReports:
      raw.publicIssueReports === true || raw.public_issue_reports === true,
    publicProposals:
      raw.publicProposals === true || raw.public_proposals === true,
    publicShareLinks:
      raw.publicShareLinks === true || raw.public_share_links === true,
    basicPublicExports:
      raw.basicPublicExports === true || raw.basic_public_exports === true,
    privateWorkspaces:
      raw.privateWorkspaces === true || raw.private_workspaces === true,
    privateProjects:
      raw.privateProjects === true || raw.private_projects === true,
    brandedExports:
      raw.brandedExports === true ||
      raw.branded_exports === true ||
      raw.unwatermarkedExports === true ||
      raw.unwatermarked_exports === true,
    advancedTemplates:
      raw.advancedTemplates === true || raw.advanced_templates === true,
    reviewThreads:
      raw.reviewThreads === true ||
      raw.review_threads === true ||
      raw.teamCollaboration === true ||
      raw.team_collaboration === true,
    approvalStates:
      raw.approvalStates === true || raw.approval_states === true,
    memberRoles: raw.memberRoles === true || raw.member_roles === true,
    billingAdmin: raw.billingAdmin === true || raw.billing_admin === true,
    invoiceMode: raw.invoiceMode === true || raw.invoice_mode === true,
    auditLogs: raw.auditLogs === true || raw.audit_logs === true,
    sso: raw.sso === true,
    customOverlays:
      raw.customOverlays === true || raw.custom_overlays === true,
    retentionControls:
      raw.retentionControls === true || raw.retention_controls === true,
    prioritySupport:
      raw.prioritySupport === true || raw.priority_support === true,
  };
}

function normalizeBillingState(value: unknown): BillingState {
  if (!value || typeof value !== 'object') return LOCAL_BILLING_STATE;

  const raw = value as Partial<BillingState> & {
    billingStatus?: unknown;
    entitlementSummary?: unknown;
    canManageBilling?: unknown;
    organization?: Record<string, unknown> | null;
    subscription?: {
      stripePriceLookupKey?: unknown;
    } | null;
  };

  const rawStatus =
    typeof raw.status === 'string'
      ? raw.status
      : typeof raw.billingStatus === 'string'
        ? raw.billingStatus
        : 'none';

  const currentPeriodEnd =
    typeof raw.currentPeriodEnd === 'string'
      ? raw.currentPeriodEnd
      : typeof raw.currentPeriodEnd === 'number'
        ? toIsoStringFromTimestamp(raw.currentPeriodEnd)
        : null;

  const contractRenewalDate =
    raw.organization &&
    typeof raw.organization.contractRenewalDate === 'number'
      ? toIsoStringFromTimestamp(raw.organization.contractRenewalDate)
      : typeof raw.organization?.contractRenewalDate === 'string'
        ? raw.organization.contractRenewalDate
        : null;

  return {
    planKey: normalizePlanKey(raw.planKey),
    interval: 'annual',
    status:
      rawStatus === 'inactive' ||
      rawStatus === 'pending' ||
      rawStatus === 'trialing' ||
      rawStatus === 'active' ||
      rawStatus === 'past_due' ||
      rawStatus === 'canceled' ||
      rawStatus === 'incomplete' ||
      rawStatus === 'unpaid'
        ? rawStatus
        : 'none',
    currentPeriodEnd,
    cancelAtPeriodEnd: raw.cancelAtPeriodEnd === true,
    billingEmail:
      typeof raw.billingEmail === 'string' ? raw.billingEmail : null,
    customerPortalEnabled:
      raw.customerPortalEnabled === true || raw.canManageBilling === true,
    entitlements: normalizeEntitlements(
      raw.entitlements ?? raw.entitlementSummary,
    ),
    organization:
      raw.organization && typeof raw.organization === 'object'
        ? {
            organizationId:
              typeof raw.organization.organizationId === 'string'
                ? raw.organization.organizationId
                : '',
            organizationType:
              typeof raw.organization.organizationType === 'string'
                ? raw.organization.organizationType
                : null,
            jurisdictionName:
              typeof raw.organization.jurisdictionName === 'string'
                ? raw.organization.jurisdictionName
                : null,
            populationBand:
              typeof raw.organization.populationBand === 'string'
                ? raw.organization.populationBand
                : null,
            contractTier:
              typeof raw.organization.contractTier === 'string'
                ? raw.organization.contractTier
                : null,
            procurementState:
              typeof raw.organization.procurementState === 'string'
                ? raw.organization.procurementState
                : null,
            invoiceMode:
              typeof raw.organization.invoiceMode === 'string'
                ? raw.organization.invoiceMode
                : null,
            purchaseOrderNumber:
              typeof raw.organization.purchaseOrderNumber === 'string'
                ? raw.organization.purchaseOrderNumber
                : null,
            contractRenewalDate,
          }
        : null,
    source: 'remote',
    message: typeof raw.message === 'string' ? raw.message : null,
  };
}

export interface UseBillingResult {
  user: ReturnType<typeof useAuth>['user'];
  sessionToken: string | null;
  isLoadingAuth: boolean;
  billingState: BillingState;
  billingStateLoading: boolean;
  billingError: string | null;
  isStartingCheckout: boolean;
  isOpeningPortal: boolean;
  refreshBillingState: () => Promise<BillingState>;
  startCheckout: () => Promise<string | null>;
  openPortal: () => Promise<string | null>;
}

export function useBilling(): UseBillingResult {
  const convex = useConvex();
  const { user, sessionToken, isLoading: isLoadingAuth } = useAuth();
  const [billingState, setBillingState] =
    useState<BillingState>(LOCAL_BILLING_STATE);
  const [billingStateLoading, setBillingStateLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const refreshBillingState = useCallback(async () => {
    if (!sessionToken) {
      setBillingState(LOCAL_BILLING_STATE);
      setBillingStateLoading(false);
      setBillingError(null);
      return LOCAL_BILLING_STATE;
    }

    setBillingStateLoading(true);
    try {
      const result = await convex.query(api.billing.getBillingState, {
        sessionToken,
      });
      const normalized = normalizeBillingState(result);
      setBillingState(normalized);
      setBillingError(null);
      return normalized;
    } catch (error) {
      setBillingState(LOCAL_BILLING_STATE);
      setBillingError(
        error instanceof Error ? error.message : 'Billing state unavailable',
      );
      return LOCAL_BILLING_STATE;
    } finally {
      setBillingStateLoading(false);
    }
  }, [convex, sessionToken]);

  useEffect(() => {
    void refreshBillingState();
  }, [refreshBillingState]);

  const startCheckout = useCallback(async () => {
    if (!sessionToken) {
      throw new Error('No active session');
    }

    const origin = getAppOrigin();
    const successUrl = `${origin}/billing/success`;
    const cancelUrl = `${origin}/billing/cancel`;

    setIsStartingCheckout(true);
    try {
      const result = (await convex.action(
        api.billingActions.createCheckoutSession,
        {
          sessionToken,
          planKey: 'town_essential',
          interval: 'year',
          successUrl,
          cancelUrl,
        },
      )) as BillingCheckoutResult;
      const url = resolveUrl(result);
      if (!url) {
        throw new Error('Billing provider did not return a checkout URL');
      }
      window.location.assign(url);
      return url;
    } finally {
      setIsStartingCheckout(false);
    }
  }, [convex, sessionToken]);

  const openPortal = useCallback(async () => {
    if (!sessionToken) {
      throw new Error('No active session');
    }

    const origin = getAppOrigin();
    setIsOpeningPortal(true);
    try {
      const result = (await convex.action(
        api.billingActions.createPortalSession,
        {
          sessionToken,
          returnUrl: `${origin}/account`,
        },
      )) as BillingPortalResult;
      const url = resolveUrl(result);
      if (!url) {
        throw new Error('Billing provider did not return a portal URL');
      }
      window.location.assign(url);
      return url;
    } finally {
      setIsOpeningPortal(false);
    }
  }, [convex, sessionToken]);

  return {
    user,
    sessionToken,
    isLoadingAuth,
    billingState,
    billingStateLoading,
    billingError,
    isStartingCheckout,
    isOpeningPortal,
    refreshBillingState,
    startCheckout,
    openPortal,
  };
}
