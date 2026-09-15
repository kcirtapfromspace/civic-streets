import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import {
  useGovernmentHub,
  useGovernmentLeadSubmission,
  useJurisdictionSummaryForLocation,
  useUnsignedOutreach,
} from '../government';
import { useOrganizationContext } from '../organization';
import * as areas from '../use-service-areas';

const port = vi.hoisted(() => ({
  sessionToken: 'session' as string | null,
  raw: undefined as unknown,
  query: vi.fn(),
  mutation: vi.fn(),
  mutate: vi.fn(),
  client: { action: vi.fn() },
}));
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => {
    port.query(...args);
    return port.raw;
  },
  useMutation: (...args: unknown[]) => {
    port.mutation(...args);
    return port.mutate;
  },
  useConvex: () => port.client,
}));
vi.mock('../auth', () => ({ useAuth: () => ({ sessionToken: port.sessionToken }) }));
beforeEach(() => {
  vi.clearAllMocks();
  port.sessionToken = 'session';
  port.raw = undefined;
  port.mutate.mockResolvedValue({ id: 'created' });
  port.client.action.mockResolvedValue({ queued: true });
});
afterEach(cleanup);

it('loads the government hub only for an active session and discards malformed records', () => {
  const { result, rerender } = renderHook(useGovernmentHub);
  expect(result.current).toEqual({ hub: null, isLoading: true });
  port.sessionToken = null;
  rerender();
  expect(result.current.isLoading).toBe(false);
  expect(port.query.mock.lastCall?.[1]).toBe('skip');
  port.sessionToken = 'session';
  for (const raw of [
    null,
    false,
    { coverage: null, latestLead: null },
    { coverage: {}, latestLead: {} },
  ]) {
    port.raw = raw;
    rerender();
    expect(result.current.isLoading).toBe(false);
    if (raw && typeof raw === 'object')
      expect(result.current.hub).toEqual({ coverage: null, latestLead: null });
    else expect(result.current.hub).toBeNull();
  }
});

it('normalizes full contacts and leads and filters malformed contacts', () => {
  const contact = {
    contactId: 'c1',
    contactType: 'district_representative',
    officeType: 'council',
    districtLabel: 'District 1',
    name: 'Rep',
    title: 'Councilmember',
    email: 'office@example.gov',
    phone: '123',
    sourceUrl: 'https://example.gov',
    confidence: 0.9,
    freshUntil: 1000,
  };
  const coverage = {
    coverageId: 'coverage',
    slug: 'denver',
    displayName: 'Denver',
    jurisdictionType: 'city',
    stateCode: 'CO',
    status: 'pilot',
    isSigned: true,
    officialWebsiteUrl: 'https://denvergov.org',
    contactCount: 2,
    freshContactCount: 1,
    topContacts: [contact, null, 42, {}, { contactId: 'minimal' }],
    lastContactSyncAt: 10,
    lastDiscoveryAttemptAt: 20,
  };
  const lead = {
    leadId: 'lead',
    jurisdictionName: 'Denver',
    workEmail: 'office@example.gov',
    roleTitle: 'Planner',
    sourceSurface: 'landing',
    requestedFeature: 'service areas',
    status: 'reviewing',
    submissionCount: 2,
    lastSubmittedAt: 30,
  };
  port.raw = { coverage, latestLead: lead };
  const { result, rerender } = renderHook(useGovernmentHub);
  expect(result.current.hub?.latestLead).toEqual(lead);
  expect(result.current.hub?.coverage).toEqual({
    ...coverage,
    topContacts: [
      contact,
      {
        contactId: 'minimal',
        contactType: 'municipal',
        officeType: 'general',
        districtLabel: null,
        name: '',
        title: '',
        email: null,
        phone: null,
        sourceUrl: '',
        confidence: 0,
        freshUntil: 0,
      },
    ],
  });
  port.raw = {
    coverage: { slug: 'denver', displayName: 'Denver' },
    latestLead: { leadId: 'minimal' },
  };
  rerender();
  expect(result.current.hub?.coverage).toMatchObject({
    coverageId: null,
    jurisdictionType: 'city',
    stateCode: null,
    status: 'unsigned',
    isSigned: false,
    topContacts: [],
    lastContactSyncAt: null,
  });
  expect(result.current.hub?.latestLead).toMatchObject({
    jurisdictionName: '',
    workEmail: '',
    roleTitle: '',
    sourceSurface: 'account',
    requestedFeature: null,
    status: 'new',
    submissionCount: 1,
    lastSubmittedAt: expect.any(Number),
  });
});

it.each(['outreach', 'pilot', 'active', 'paused', 'unexpected'])(
  'looks up %s jurisdiction status by address and skips empty addresses',
  (status) => {
    const args = { address: 'Denver, CO', lat: 39.7, lng: -104.9 };
    const { result, rerender } = renderHook((input) => useJurisdictionSummaryForLocation(input), {
      initialProps: args,
    });
    expect(result.current.isLoading).toBe(true);
    expect(port.query.mock.lastCall?.[1]).toEqual(args);
    port.raw = { slug: 'denver', displayName: 'Denver', status };
    rerender(args);
    expect(result.current.summary?.status).toBe(status === 'unexpected' ? 'unsigned' : status);
    rerender({ ...args, address: '' });
    expect(result.current.isLoading).toBe(false);
    expect(port.query.mock.lastCall?.[1]).toBe('skip');
  },
);

it('submits a lead and outreach with the session, resets pending state, and propagates failures', async () => {
  let resolve!: (value: unknown) => void;
  port.mutate.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result, rerender } = renderHook(() => ({
    lead: useGovernmentLeadSubmission(),
    outreach: useUnsignedOutreach(),
  }));
  const lead = {
    jurisdictionName: 'Denver',
    workEmail: 'planner@example.gov',
    roleTitle: 'Planner',
    sourceSurface: 'account' as const,
  };
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.lead.submitLead(lead);
  });
  expect(result.current.lead.isSubmitting).toBe(true);
  expect(port.mutate).toHaveBeenCalledWith({ sessionToken: 'session', ...lead });
  await act(async () => {
    resolve('lead-id');
    expect(await pending).toBe('lead-id');
  });
  expect(result.current.lead.isSubmitting).toBe(false);
  const outreach = {
    sourceAction: 'report_to_city' as const,
    hotspot: {
      title: 'Crossing',
      description: 'Missing curb',
      address: 'Denver',
      lat: 39.7,
      lng: -104.9,
      category: 'other',
    },
  };
  await act(async () => {
    expect(await result.current.outreach.queueUnsignedOutreach(outreach)).toEqual({ queued: true });
  });
  expect(port.client.action.mock.lastCall?.[1]).toEqual({ sessionToken: 'session', ...outreach });
  port.mutate.mockRejectedValueOnce(new Error('Lead failed'));
  port.client.action.mockRejectedValueOnce(new Error('Queue failed'));
  await act(async () => {
    await expect(result.current.lead.submitLead(lead)).rejects.toThrow('Lead failed');
    await expect(result.current.outreach.queueUnsignedOutreach(outreach)).rejects.toThrow(
      'Queue failed',
    );
  });
  expect(result.current.lead.isSubmitting || result.current.outreach.isSubmitting).toBe(false);
  port.sessionToken = null;
  rerender();
  await expect(result.current.lead.submitLead(lead)).rejects.toThrow('No active session');
  await expect(result.current.outreach.queueUnsignedOutreach(outreach)).rejects.toThrow(
    'No active session',
  );
});

it('normalizes organization context without provisioning by default', () => {
  const { result, rerender } = renderHook(useOrganizationContext);
  expect(result.current.organizationLoading).toBe(true);
  port.raw = null;
  rerender();
  expect(result.current.organization).toBeNull();
  expect(result.current.organizationLoading).toBe(false);
  expect(port.mutate).not.toHaveBeenCalled();
  port.raw = {};
  rerender();
  expect(result.current.organization).toMatchObject({
    organizationId: '',
    name: 'Curbwise Organization',
    organizationType: 'individual',
    contractTier: 'civic_free',
    memberRole: 'owner',
    contractRenewalDate: null,
  });
  const organization = {
    organizationId: 'org',
    workspaceId: 'ws',
    name: 'Denver',
    slug: 'denver',
    organizationType: 'city',
    jurisdictionName: 'Denver',
    populationBand: 'large',
    contractTier: 'city_standard',
    procurementState: 'approved',
    invoiceMode: 'invoice',
    purchaseOrderNumber: 'PO-1',
    contractRenewalDate: 1_800_000_000,
    memberRole: 'member',
    workspaceName: 'Streets',
  };
  port.raw = organization;
  rerender();
  expect(result.current.organization).toEqual({
    ...organization,
    contractRenewalDate: new Date(1_800_000_000_000).toISOString(),
  });
  port.raw = { ...organization, contractRenewalDate: 1_800_000_000_000 };
  rerender();
  expect(result.current.organization?.contractRenewalDate).toBe(
    new Date(1_800_000_000_000).toISOString(),
  );
  port.raw = { ...organization, contractRenewalDate: '2028-01-01' };
  rerender();
  expect(result.current.organization?.contractRenewalDate).toBe('2028-01-01');
  port.sessionToken = null;
  port.raw = undefined;
  rerender();
  expect(result.current.organizationLoading).toBe(false);
  expect(port.query.mock.lastCall?.[1]).toBe('skip');
});

it('bootstraps once per session only after a confirmed missing organization', async () => {
  const { result, rerender } = renderHook(
    (bootstrapIfMissing) => useOrganizationContext({ bootstrapIfMissing }),
    { initialProps: true },
  );
  expect(port.mutate).not.toHaveBeenCalled();
  port.raw = null;
  rerender(true);
  expect(result.current.organizationLoading).toBe(true);
  expect(port.mutate).toHaveBeenCalledExactlyOnceWith({ sessionToken: 'session' });
  rerender(true);
  expect(port.mutate).toHaveBeenCalledTimes(1);
  await act(async () => {
    await Promise.resolve();
  });
  port.raw = { organizationId: 'created' };
  rerender(true);
  expect(result.current.organizationLoading).toBe(false);
  port.sessionToken = 'new-session';
  port.raw = null;
  rerender(true);
  expect(port.mutate).toHaveBeenLastCalledWith({ sessionToken: 'new-session' });
  rerender(false);
  expect(result.current.organizationLoading).toBe(false);
});

it.each([new Error('Provisioning unavailable'), 'failure'])(
  'ends organization loading when bootstrap fails',
  async (failure) => {
    port.raw = null;
    port.mutate.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useOrganizationContext({ bootstrapIfMissing: true }));
    await waitFor(() => expect(result.current.organizationLoading).toBe(false));
    expect(result.current.organizationError).toBe(
      failure instanceof Error ? failure.message : 'Organization setup unavailable',
    );
    expect(result.current.organization).toBeNull();
  },
);

it.each([
  [areas.useServiceAreas, 'serviceAreas:getActiveByOrganization', 'organizationId'],
  [areas.useAllServiceAreas, 'serviceAreas:list', 'organizationId'],
  [areas.useServiceAreaById, 'serviceAreas:getById', 'serviceAreaId'],
  [areas.useHotspotsByServiceArea, 'hotspots:getByServiceArea', 'serviceAreaId'],
  [areas.useHeatmapByServiceArea, 'hotspots:getHeatmapByServiceArea', 'serviceAreaId'],
] as const)(
  'scopes a service area subscription and skips missing IDs (%s)',
  (hook, endpoint, key) => {
    const { result, rerender } = renderHook((id: string | undefined) => hook(id), {
      initialProps: undefined as string | undefined,
    });
    expect(result.current).toBeUndefined();
    expect(port.query.mock.lastCall?.[1]).toBe('skip');
    port.raw = [{ id: 'row' }];
    rerender('requested-id');
    expect(getFunctionName(port.query.mock.lastCall?.[0])).toBe(endpoint);
    expect(port.query.mock.lastCall?.[1]).toEqual({ [key]: 'requested-id' });
    expect(result.current).toEqual([{ id: 'row' }]);
  },
);

it.each([
  [areas.useCreateServiceArea, 'serviceAreas:create'],
  [areas.useUpdateServiceArea, 'serviceAreas:update'],
  [areas.useRemoveServiceArea, 'serviceAreas:remove'],
] as const)(
  'routes service area commands to their correct mutation (%s)',
  async (hook, endpoint) => {
    const { result } = renderHook((): unknown => hook());
    expect(getFunctionName(port.mutation.mock.lastCall?.[0])).toBe(endpoint);
    expect(result.current).toBe(port.mutate);
  },
);
