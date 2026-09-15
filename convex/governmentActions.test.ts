// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const location = { address: 'Denver, CO', lat: 39.74, lng: -104.99 };
const hotspot = {
  ...location,
  id: 'issue_1',
  title: 'Crossing',
  description: 'Curb access',
  category: 'accessibility',
  upvotes: 5,
};
const network = vi.fn<typeof fetch>();
async function setup() {
  const t = convexTest(schema, modules);
  const owner = await t.mutation(api.users.createAnonymousUser, {});
  const coverage = (await t.mutation(internal.government.ensureCoverageForLocation, location))!;
  return { t, owner, coverage };
}
const contact = (name: string, fields = {}) => ({
  name,
  title: `${name} office`,
  contactType: 'municipal',
  officeType: 'general',
  sourceUrl: 'https://www.denvergov.org/contact',
  sourceDomain: 'denvergov.org',
  normalizedIdentity: name,
  confidence: 0.8,
  freshUntil: Date.now() + 1000,
  ...fields,
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
  network.mockReset().mockRejectedValue(new Error('Unexpected network request'));
  vi.stubGlobal('fetch', network);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('government contact discovery actions', () => {
  it('requires a session before resolving coverage or fetching official pages', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.governmentActions.ensureJurisdictionContacts, {
        ...location,
        sessionToken: 'bad',
      }),
    ).rejects.toThrow('active session');
    expect(network).not.toHaveBeenCalled();
    expect(await t.run((ctx) => ctx.db.query('jurisdictionCoverage').collect())).toEqual([]);
  });

  it('uses fresh cached contacts, prioritizes district recipients and never leaks private user fields', async () => {
    const { t, owner, coverage } = await setup();
    await t.mutation(internal.government.saveDiscoveredContacts, {
      coverageId: coverage._id,
      contacts: [
        contact('Town', { confidence: 1, email: 'town@denvergov.org' }),
        contact('District', {
          contactType: 'district_representative',
          districtLabel: '2',
          phone: '3035550100',
        }),
        contact('Third'),
        contact('Fourth'),
      ],
    });
    const result = await t.action(api.governmentActions.ensureJurisdictionContacts, {
      ...location,
      sessionToken: owner.sessionToken,
    });
    expect(result).toMatchObject({
      discoveryState: 'cached',
      contactCount: 4,
      coverage: { isSigned: false },
    });
    expect(result.recipientPreview).toHaveLength(3);
    expect(result.recipientPreview[0]).toMatchObject({
      title: 'District office',
      email: null,
      phone: '3035550100',
    });
    expect(result).not.toHaveProperty('sessionToken');
    expect(network).not.toHaveBeenCalled();
  });

  it.each(['pilot', 'active'])(
    'keeps signed %s coverage in its live workflow even without contacts',
    async (desiredStatus) => {
      const { t, owner } = await setup();
      await t.mutation(internal.government.ensureCoverageForLocation, {
        ...location,
        desiredStatus,
      });
      const result = await t.action(api.governmentActions.queueUnsignedOutreach, {
        sessionToken: owner.sessionToken,
        sourceAction: 'report_to_city',
        hotspot,
      });
      expect(result).toMatchObject({ status: 'signed', coverage: { status: desiredStatus } });
      expect(network).not.toHaveBeenCalled();
      expect(await t.run((ctx) => ctx.db.query('outreachRequests').collect())).toEqual([]);
    },
  );

  it('records discovery failures and honestly queues contact collection for unknown municipalities', async () => {
    const { t, owner } = await setup();
    const remote = { address: 'Remote village', lat: 0, lng: 0 };
    const result = await t.action(api.governmentActions.ensureJurisdictionContacts, {
      ...remote,
      sessionToken: owner.sessionToken,
      officeScope: 'municipal',
    });
    expect(result).toMatchObject({
      discoveryState: 'queued',
      contactCount: 0,
      coverage: { officialWebsiteUrl: null },
    });
    expect(network).not.toHaveBeenCalled();
    const queued = await t.action(api.governmentActions.queueUnsignedOutreach, {
      sessionToken: owner.sessionToken,
      sourceAction: 'send_to_rep',
      hotspot: { ...hotspot, ...remote },
    });
    expect(queued).toMatchObject({
      status: 'collecting_contacts',
      recipients: [],
      coverage: { officialWebsiteUrl: null },
    });
    const jobs = await t.run((ctx) => ctx.db.query('contactDiscoveryJobs').collect());
    expect(
      jobs.every(
        (job) =>
          job.status === 'failed' &&
          job.attempts === 1 &&
          job.errorMessage === 'No official public contacts were found yet',
      ),
    ).toBe(true);
    expect(await t.run((ctx) => ctx.db.query('outreachRequests').collect())).toEqual([
      expect.objectContaining({ status: 'collecting_contacts', requestedByUserId: owner.user._id }),
    ]);
  });

  it('refreshes stale contact records, deduplicates discovered email and phone identities, and bounds traversal to six official pages', async () => {
    const { t, owner, coverage } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(coverage._id, {
        officialWebsiteUrl: 'https://www.denvergov.org',
        directoryUrls: ['https://www.denvergov.org/contact'],
        districtDirectoryUrls: ['https://www.denvergov.org/council'],
      }),
    );
    const pages: Record<string, string> = {
      '/': '<title>City directory</title><a href="mailto:staff@denvergov.org">Email</a><a href="tel:3035550100">Phone</a><a href="/about">About</a><a href="https://attacker.test/contact">Off site</a><a href="/contact">Contact</a><a href="/transportation">Roads</a><a href="/public-works">Public works</a><a href="/mayor">Mayor</a><a href="/council">Council</a><a href="/district/2">District</a><a href="/department">Department</a><a href="http://[bad/contact">Malformed</a><a href="javascript:contact()">Bad scheme</a>staff@denvergov.org staff@denvergov.org (303) 555-0100 image@assets.png ignored@example.org',
      '/contact': '<title>City contacts</title>staff@denvergov.org 303-555-0100',
      '/council': '<title>City council</title>council@denvergov.org',
      '/transportation': 'roads@denvergov.org',
      '/public-works': '<title>Works</title>303.555.0200',
      '/mayor': '<title>Mayor</title>No direct contact available',
    };
    network.mockImplementation(
      async (input) =>
        new Response(pages[new URL(String(input)).pathname] ?? '<title>Other</title>', {
          status: 200,
        }),
    );
    const result = await t.action(api.governmentActions.ensureJurisdictionContacts, {
      ...location,
      sessionToken: owner.sessionToken,
      officeScope: 'both',
      hotspotId: 'issue_1',
    });
    expect(result).toMatchObject({ discoveryState: 'discovered', contactCount: 5 });
    expect(network).toHaveBeenCalledTimes(6);
    expect(
      network.mock.calls.every(([url]) => new URL(String(url)).hostname === 'www.denvergov.org'),
    ).toBe(true);
    const contacts = await t.query(internal.government.getCoverageContacts, {
      coverageId: coverage._id,
    });
    expect(contacts.map((c) => c.officeType).sort()).toEqual([
      'district_representative',
      'general',
      'mayor',
      'public_works',
      'transportation',
    ]);
    expect(contacts.find((c) => c.officeType === 'mayor')).toMatchObject({
      confidence: 0.28,
      title: 'Executive office contact',
    });
    expect(contacts.find((c) => c.officeType === 'public_works')).toMatchObject({
      phone: '3035550200',
      confidence: 0.62,
    });
    expect(contacts.find((c) => c.officeType === 'general')).toMatchObject({
      email: 'staff@denvergov.org',
      phone: '3035550100',
    });
    expect(contacts.every((c) => c.freshUntil === Date.now() + 14 * 86400000)).toBe(true);
    expect((await t.run((ctx) => ctx.db.query('contactDiscoveryJobs').first()))?.status).toBe(
      'completed',
    );
    network.mockClear();
    expect(
      (
        await t.action(api.governmentActions.ensureJurisdictionContacts, {
          ...location,
          sessionToken: owner.sessionToken,
        })
      ).discoveryState,
    ).toBe('cached');
    expect(network).not.toHaveBeenCalled();
  });

  it.each(['municipal', 'district_representative'] as const)(
    'follows only relevant %s links and accepts official subdomains',
    async (officeScope) => {
      const { t, owner, coverage } = await setup();
      await t.run((ctx) =>
        ctx.db.patch(coverage._id, {
          officialWebsiteUrl: 'https://www.denvergov.org',
          directoryUrls: ['https://www.denvergov.org'],
          districtDirectoryUrls: ['https://www.denvergov.org'],
        }),
      );
      const cityLink = 'https://transport.denvergov.org/contact';
      const districtLink = 'https://council.denvergov.org/district';
      network.mockImplementation(
        async (input) =>
          new Response(
            String(input) === 'https://www.denvergov.org'
              ? `<a href="${cityLink}">Contact</a><a href="${districtLink}">Council</a><a href="https://denvergov.org.attacker.test/contact/district">Attack</a>`
              : '<title>Office</title>office@denvergov.org',
            { status: 200 },
          ),
      );
      const result = await t.action(api.governmentActions.ensureJurisdictionContacts, {
        ...location,
        sessionToken: owner.sessionToken,
        officeScope,
      });
      expect(result.discoveryState).toBe('discovered');
      expect(network.mock.calls.map(([url]) => String(url))).toEqual([
        'https://www.denvergov.org',
        officeScope === 'municipal' ? cityLink : districtLink,
      ]);
      const records = await t.query(internal.government.getCoverageContacts, {
        coverageId: coverage._id,
      });
      expect(records.find((c) => c.email)).toMatchObject({ contactType: officeScope });
    },
  );

  it('skips malformed or unsupported stored URLs and continues after HTTP/network errors', async () => {
    const { t, owner, coverage } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(coverage._id, {
        officialWebsiteUrl: 'malformed',
        directoryUrls: [
          'ftp://www.denvergov.org/contact',
          'https://www.denvergov.org/contact',
          'https://www.denvergov.org/mayor',
          'https://www.denvergov.org/council',
        ],
        districtDirectoryUrls: ['https://www.denvergov.org/council'],
      }),
    );
    network.mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === '/contact') return new Response('Unavailable', { status: 503 });
      if (path === '/mayor') throw new Error('Network offline');
      return new Response('council@denvergov.org', { status: 200 });
    });
    const result = await t.action(api.governmentActions.ensureJurisdictionContacts, {
      ...location,
      sessionToken: owner.sessionToken,
    });
    expect(result).toMatchObject({ discoveryState: 'discovered', contactCount: 1 });
    expect(network).toHaveBeenCalledTimes(3);
    expect(result.recipientPreview[0].title).toBe('District representative contact');
  });

  it('reports complete upstream failure without a false contact count or completed job', async () => {
    const { t, owner } = await setup();
    network.mockResolvedValue(new Response('Unavailable', { status: 503 }));
    expect(
      await t.action(api.governmentActions.ensureJurisdictionContacts, {
        ...location,
        sessionToken: owner.sessionToken,
      }),
    ).toMatchObject({ discoveryState: 'queued', contactCount: 0, recipientPreview: [] });
    expect((await t.run((ctx) => ctx.db.query('contactDiscoveryJobs').first()))?.status).toBe(
      'failed',
    );
  });

  it.each(['report_to_city', 'send_to_rep'] as const)(
    'queues an explicit %s draft with scoped recipients and does not send it',
    async (sourceAction) => {
      const { t, owner, coverage } = await setup();
      await t.mutation(internal.government.saveDiscoveredContacts, {
        coverageId: coverage._id,
        contacts: [
          contact('Town', { email: 'town@denvergov.org' }),
          contact('District', { contactType: 'district_representative', phone: '3035550100' }),
        ],
      });
      const result = await t.action(api.governmentActions.queueUnsignedOutreach, {
        sessionToken: owner.sessionToken,
        sourceAction,
        hotspot,
      });
      expect(result).toMatchObject({
        status: 'queued_review',
        coverage: { status: 'outreach' },
        draft: { body: expect.stringContaining('5 votes') },
      });
      if (result.status === 'signed') throw new Error('Unexpected signed result');
      expect(result.recipients.map((r) => r.title)).toEqual(
        sourceAction === 'report_to_city' ? ['Town office'] : ['District office', 'Town office'],
      );
      const retry = await t.action(api.governmentActions.queueUnsignedOutreach, {
        sessionToken: owner.sessionToken,
        sourceAction,
        hotspot,
      });
      expect(retry).toMatchObject({ requestId: result.requestId });
      expect(await t.run((ctx) => ctx.db.query('outreachRequests').collect())).toEqual([
        expect.objectContaining({
          status: 'queued_review',
          body: result.draft.body,
          requestedByUserId: owner.user._id,
        }),
      ]);
      expect(network).not.toHaveBeenCalled();
    },
  );
});
