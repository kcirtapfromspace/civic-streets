import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBilling } from '../billing';
import { api } from '../../../../convex/_generated/api';
import {
  useBillingAccess,
  getGovernmentContactHref,
  canAccessBillingFeature,
  BILLING_FEATURE_LABELS,
  type BillingFeatureKey,
} from '@/lib/billing/access';
import { BILLING_PLANS, getBillingIntervalLabel, getPlanByKey } from '@/lib/billing/plans';
import type { BillingPlanKey } from '@/lib/billing/types';

const port = vi.hoisted(() => ({
  auth: { user: null, sessionToken: 'session' as string | null, isLoading: false },
  client: { query: vi.fn(), action: vi.fn() },
}));
vi.mock('convex/react', () => ({ useConvex: () => port.client }));
vi.mock('../auth', () => ({ useAuth: () => port.auth }));
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  port.auth.sessionToken = 'session';
  port.client.query.mockResolvedValue(null);
});
afterEach(cleanup);

describe('billing state used by account and access controls', () => {
  it('keeps unauthenticated usage free and refuses checkout or portal calls', async () => {
    port.auth.sessionToken = null;
    const { result } = renderHook(useBilling);
    expect(result.current.billingState).toMatchObject({
      planKey: 'civic_free',
      source: 'local',
      entitlements: { publicHotspots: true, privateWorkspaces: false },
    });
    expect(result.current.billingStateLoading).toBe(false);
    await expect(result.current.startCheckout()).rejects.toThrow('No active session');
    await expect(result.current.openPortal()).rejects.toThrow('No active session');
    expect(port.client.query).not.toHaveBeenCalled();
    expect(port.client.action).not.toHaveBeenCalled();
  });

  it.each([
    ['town_essential', 'town_essential', 'inactive'],
    ['pro', 'town_essential', 'pending'],
    ['city_standard', 'city_standard', 'trialing'],
    ['team', 'city_standard', 'active'],
    ['agency_enterprise', 'agency_enterprise', 'past_due'],
    ['enterprise', 'agency_enterprise', 'canceled'],
    ['unknown', 'civic_free', 'incomplete'],
    ['civic_free', 'civic_free', 'unpaid'],
  ])(
    'normalizes plan %s and status %s from a provider snapshot',
    async (planKey, expected, status) => {
      port.client.query.mockResolvedValue({ planKey, status });
      const { result } = renderHook(useBilling);
      await waitFor(() => expect(result.current.billingStateLoading).toBe(false));
      expect(result.current.billingState).toMatchObject({
        planKey: expected,
        status,
        source: 'remote',
      });
      expect(port.client.query).toHaveBeenCalledWith(api.billing.getBillingState, {
        sessionToken: 'session',
      });
    },
  );

  it('normalizes timestamps, procurement metadata, portal rights and every entitlement', async () => {
    const entitlements = {
      publicHotspots: true,
      publicIssueReports: true,
      publicProposals: true,
      publicShareLinks: true,
      basicPublicExports: true,
      privateWorkspaces: true,
      privateProjects: true,
      brandedExports: true,
      advancedTemplates: true,
      reviewThreads: true,
      approvalStates: true,
      memberRoles: true,
      billingAdmin: true,
      invoiceMode: true,
      auditLogs: true,
      sso: true,
      customOverlays: true,
      retentionControls: true,
      prioritySupport: true,
    };
    const organization = {
      organizationId: 'org',
      organizationType: 'city',
      jurisdictionName: 'Denver',
      populationBand: 'large',
      contractTier: 'city_standard',
      procurementState: 'approved',
      invoiceMode: 'invoice',
      purchaseOrderNumber: 'PO-1',
      contractRenewalDate: 1_800_000_000_000,
    };
    port.client.query.mockResolvedValue({
      planKey: 'team',
      billingStatus: 'active',
      entitlements,
      organization,
      currentPeriodEnd: 1_800_000_000,
      cancelAtPeriodEnd: true,
      billingEmail: 'billing@example.org',
      customerPortalEnabled: true,
      message: 'Renewal pending',
    });
    const { result } = renderHook(useBilling);
    await waitFor(() => expect(result.current.billingStateLoading).toBe(false));
    expect(result.current.billingState).toMatchObject({
      entitlements,
      organization: {
        ...organization,
        contractRenewalDate: new Date(1_800_000_000_000).toISOString(),
      },
      currentPeriodEnd: new Date(1_800_000_000_000).toISOString(),
      cancelAtPeriodEnd: true,
      billingEmail: 'billing@example.org',
      customerPortalEnabled: true,
      message: 'Renewal pending',
    });

    const snakeCase = Object.fromEntries(
      Object.keys(entitlements).map((key) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        true,
      ]),
    );
    port.client.query.mockResolvedValue({
      entitlementSummary: snakeCase,
      canManageBilling: true,
      currentPeriodEnd: '2027-01-01',
      organization: { contractRenewalDate: '2028-01-01' },
    });
    await act(async () => {
      await result.current.refreshBillingState();
    });
    expect(result.current.billingState.entitlements).toEqual(entitlements);
    expect(result.current.billingState).toMatchObject({
      currentPeriodEnd: '2027-01-01',
      customerPortalEnabled: true,
      organization: {
        organizationId: '',
        organizationType: null,
        contractRenewalDate: '2028-01-01',
      },
    });
  });

  it.each([
    { unwatermarkedExports: true, teamCollaboration: true },
    { unwatermarked_exports: true, team_collaboration: true },
  ])(
    'recognizes legacy feature names without granting unrelated permissions',
    async (entitlements) => {
      port.client.query.mockResolvedValue({ entitlements, status: 'invented', organization: {} });
      const { result } = renderHook(useBilling);
      await waitFor(() => expect(result.current.billingStateLoading).toBe(false));
      expect(result.current.billingState.entitlements).toMatchObject({
        brandedExports: true,
        reviewThreads: true,
        billingAdmin: false,
        sso: false,
      });
      expect(result.current.billingState.status).toBe('none');
      expect(result.current.billingState.organization?.contractRenewalDate).toBeNull();
    },
  );

  it.each([new Error('Offline'), 'unstructured failure'])(
    'falls back safely on query failure and allows retry',
    async (error) => {
      port.client.query.mockRejectedValueOnce(error);
      const { result } = renderHook(useBilling);
      await waitFor(() =>
        expect(result.current.billingError).toBe(
          error instanceof Error ? 'Offline' : 'Billing state unavailable',
        ),
      );
      expect(result.current.billingState.source).toBe('local');
      port.client.query.mockResolvedValue({ planKey: 'town_essential' });
      await act(async () => {
        await result.current.refreshBillingState();
      });
      expect(result.current.billingError).toBeNull();
      expect(result.current.billingState.planKey).toBe('town_essential');
    },
  );

  it.each(['success', 'failure'])(
    'ignores a late %s from the previous account after the session changes',
    async (outcome) => {
      let resolve!: (value: unknown) => void;
      let reject!: (reason: unknown) => void;
      port.client.query.mockReturnValueOnce(
        new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      const { result, rerender } = renderHook(useBilling);
      port.auth.sessionToken = null;
      rerender();
      expect(result.current.billingState.source).toBe('local');
      await act(async () => {
        if (outcome === 'success')
          resolve({ planKey: 'agency_enterprise', organization: { organizationId: 'old-org' } });
        else reject(new Error('Old account failed'));
      });
      expect(result.current.billingState).toMatchObject({
        source: 'local',
        planKey: 'civic_free',
        organization: null,
      });
      expect(result.current.billingError).toBeNull();
      expect(result.current.billingStateLoading).toBe(false);
    },
  );
});

describe('billing navigation requests', () => {
  function installNavigation() {
    const assign = vi.fn();
    const realWindow = window;
    vi.stubGlobal(
      'window',
      new Proxy(realWindow, {
        get(target, key) {
          return key === 'location'
            ? { origin: 'https://curbwise.example', assign }
            : Reflect.get(target, key);
        },
      }),
    );
    return assign;
  }

  it.each(['string', 'url', 'redirectUrl', 'sessionUrl', 'checkoutUrl', 'portalUrl'])(
    'navigates only after receiving the %s URL',
    async (key) => {
      const assign = installNavigation();
      const pending = deferred<unknown>();
      port.client.action.mockReturnValueOnce(pending.promise);
      const { result } = renderHook(useBilling);
      await waitFor(() => expect(result.current.billingStateLoading).toBe(false));
      let request!: Promise<string | null>;
      act(() => {
        request = result.current.startCheckout();
      });
      expect(result.current.isStartingCheckout).toBe(true);
      expect(assign).not.toHaveBeenCalled();
      expect(port.client.action).toHaveBeenCalledWith(api.billingActions.createCheckoutSession, {
        sessionToken: 'session',
        planKey: 'town_essential',
        interval: 'year',
        successUrl: 'https://curbwise.example/billing/success',
        cancelUrl: 'https://curbwise.example/billing/cancel',
      });
      await act(async () => {
        pending.resolve(
          key === 'string'
            ? 'https://billing.example/session'
            : { [key]: 'https://billing.example/session' },
        );
        await request;
      });
      expect(assign).toHaveBeenCalledWith('https://billing.example/session');
      expect(result.current.isStartingCheckout).toBe(false);
      port.client.action.mockResolvedValueOnce({ portalUrl: 'https://billing.example/portal' });
      await act(async () => {
        await result.current.openPortal();
      });
      expect(port.client.action).toHaveBeenLastCalledWith(api.billingActions.createPortalSession, {
        sessionToken: 'session',
        returnUrl: 'https://curbwise.example/account',
      });
      expect(assign).toHaveBeenLastCalledWith('https://billing.example/portal');
      expect(result.current.isOpeningPortal).toBe(false);
    },
  );

  it.each([null, 1, {}, { url: 123 }, { url: '' }])(
    'clears busy state and refuses missing provider URLs (%j)',
    async (response) => {
      const assign = installNavigation();
      port.client.action.mockResolvedValue(response);
      const { result } = renderHook(useBilling);
      await waitFor(() => expect(result.current.billingStateLoading).toBe(false));
      await act(async () => {
        await expect(result.current.startCheckout()).rejects.toThrow('checkout URL');
      });
      await act(async () => {
        await expect(result.current.openPortal()).rejects.toThrow('portal URL');
      });
      expect(assign).not.toHaveBeenCalled();
      expect(result.current.isStartingCheckout || result.current.isOpeningPortal).toBe(false);
    },
  );
});

it('keeps feature access closed while loading and enforces each requested entitlement', async () => {
  const pending = deferred<unknown>();
  port.client.query.mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(
    (feature: BillingFeatureKey) => useBillingAccess(feature),
    { initialProps: 'pdf_export' as BillingFeatureKey },
  );
  expect(result.current.canAccess).toBe(false);
  expect(result.current.billingStateLoading).toBe(true);
  await act(async () => {
    pending.resolve({
      planKey: 'town_essential',
      status: 'active',
      entitlements: { brandedExports: true },
    });
  });
  expect(result.current.canAccess).toBe(true);
  expect(result.current).toMatchObject({
    contactHref: '/account?intent=government&feature=pdf_export',
    requestedFeatureLabel: 'branded PDF exports',
    requiredPlanKey: 'town_essential',
    requiredEntitlement: 'brandedExports',
  });
  rerender('private_projects');
  expect(result.current.canAccess).toBe(false);
  rerender('audit_logs');
  expect(result.current.requiredPlanKey).toBe('agency_enterprise');
  const state = result.current.billingState;
  expect(
    canAccessBillingFeature({ ...state, planKey: 'unknown' as BillingPlanKey }, 'pdf_export'),
  ).toBe(false);
  expect(getGovernmentContactHref()).toBe('/account?intent=government');
  expect(Object.keys(BILLING_FEATURE_LABELS)).toHaveLength(9);
});

it('exposes the correct pricing plan and interval labels for checkout and account pages', () => {
  expect(getBillingIntervalLabel('monthly')).toBe('Monthly');
  expect(getBillingIntervalLabel('annual')).toBe('Annual');
  for (const plan of BILLING_PLANS) expect(getPlanByKey(plan.key)).toEqual(plan);
  expect(getPlanByKey('missing' as BillingPlanKey)).toBeUndefined();
  expect(
    BILLING_PLANS.filter((plan) => plan.ctaMode === 'self_serve').map((plan) => plan.key),
  ).toEqual(['town_essential']);
});
