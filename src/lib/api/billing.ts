import { useCallback, useEffect, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from './auth';
import type {
  BillingCheckoutResult,
  BillingEntitlements,
  BillingInterval,
  BillingPlanKey,
  BillingPortalResult,
  BillingState,
} from '@/lib/billing/types';

const LOCAL_ENTITLEMENTS: BillingEntitlements = {
  privateProjects: false,
  brandedExports: false,
  unwatermarkedExports: false,
  advancedTemplates: false,
  teamCollaboration: false,
  customTemplates: false,
  prioritySupport: false,
};

const LOCAL_BILLING_STATE: BillingState = {
  planKey: 'free',
  interval: 'monthly',
  status: 'none',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  billingEmail: null,
  customerPortalEnabled: false,
  entitlements: LOCAL_ENTITLEMENTS,
  source: 'local',
  message: null,
};

function getAppOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
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

function normalizeEntitlements(value: unknown): BillingEntitlements {
  if (!value || typeof value !== 'object') {
    return LOCAL_ENTITLEMENTS;
  }

  const raw = value as Partial<Record<string, unknown>>;
  return {
    privateProjects:
      raw.privateProjects === true || raw.private_projects === true,
    brandedExports:
      raw.brandedExports === true || raw.branded_exports === true,
    unwatermarkedExports:
      raw.unwatermarkedExports === true ||
      raw.unwatermarked_exports === true,
    advancedTemplates:
      raw.advancedTemplates === true || raw.advanced_templates === true,
    teamCollaboration:
      raw.teamCollaboration === true || raw.team_collaboration === true,
    customTemplates:
      raw.customTemplates === true || raw.custom_templates === true,
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
        ? new Date(raw.currentPeriodEnd * 1000).toISOString()
        : null;

  const lookupKey =
    raw.subscription &&
    typeof raw.subscription === 'object' &&
    typeof raw.subscription.stripePriceLookupKey === 'string'
      ? raw.subscription.stripePriceLookupKey
      : '';

  const interval =
    raw.interval === 'annual' ||
    lookupKey.includes('annual') ||
    lookupKey.includes('year')
      ? 'annual'
      : 'monthly';

  return {
    planKey:
      raw.planKey === 'pro' ||
      raw.planKey === 'team' ||
      raw.planKey === 'enterprise'
        ? raw.planKey
        : 'free',
    interval,
    status:
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
  startCheckout: (
    planKey: Exclude<BillingPlanKey, 'free' | 'enterprise'>,
    interval: BillingInterval,
  ) => Promise<string | null>;
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

  const startCheckout = useCallback(
    async (
      planKey: Exclude<BillingPlanKey, 'free' | 'enterprise'>,
      interval: BillingInterval,
    ) => {
      if (!sessionToken) {
        throw new Error('No active session');
      }

      const origin = getAppOrigin();
      const successUrl = `${origin}/billing/success`;
      const cancelUrl = `${origin}/billing/cancel`;
      const billingInterval = interval === 'annual' ? 'year' : 'month';

      setIsStartingCheckout(true);
      try {
        const result = (await convex.action(
          api.billingActions.createCheckoutSession,
          {
            sessionToken,
            planKey,
            interval: billingInterval,
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
    },
    [convex, sessionToken],
  );

  const openPortal = useCallback(async () => {
    if (!sessionToken) {
      throw new Error('No active session');
    }

    const origin = getAppOrigin();
    setIsOpeningPortal(true);
    try {
      const result = (await convex.action(api.billingActions.createPortalSession, {
        sessionToken,
        returnUrl: `${origin}/account`,
      })) as BillingPortalResult;
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
