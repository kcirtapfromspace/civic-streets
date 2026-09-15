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
  title: 'Accessible crossing',
  description: 'Missing curb ramp',
  category: 'accessibility',
};
const lead = {
  jurisdictionName: 'Denver, CO',
  workEmail: 'staff@denvergov.org',
  roleTitle: 'Planner',
  sourceSurface: 'government-hub',
};
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
});
afterEach(() => vi.useRealTimers());

describe('coverage registry and public summaries', () => {
  it('returns an honest unsigned summary before a jurisdiction is onboarded', async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.government.getJurisdictionSummaryForLocation, location)).toMatchObject(
      { slug: 'denver-co', coverageId: null, status: 'unsigned', isSigned: false, contactCount: 0 },
    );
    const unknown = { address: 'Remote village', lat: 0, lng: 0 };
    expect(await t.mutation(internal.government.ensureCoverageForLocation, unknown)).toMatchObject({
      displayName: 'Remote village',
      status: 'unsigned',
    });
    expect(
      await t.mutation(internal.government.ensureCoverageForLocation, unknown),
    ).not.toHaveProperty('officialWebsiteUrl');
  });

  it('retains stronger coverage status and known directory metadata during repeated inference', async () => {
    const { t, owner, coverage } = await setup();
    const org = await t.mutation(api.organizations.bootstrapCurrentOrganization, {
      sessionToken: owner.sessionToken,
    });
    for (const desiredStatus of ['outreach', 'pilot', 'active', 'paused']) {
      expect(
        await t.mutation(internal.government.ensureCoverageForLocation, {
          ...location,
          desiredStatus,
          activeOrganizationId: org.organizationId,
        }),
      ).toMatchObject({ _id: coverage._id, status: desiredStatus });
    }
    expect(
      await t.mutation(internal.government.ensureCoverageForLocation, {
        ...location,
        desiredStatus: 'unsigned',
      }),
    ).toMatchObject({ status: 'paused', activeOrganizationId: org.organizationId });
    expect(await t.mutation(internal.government.ensureCoverageForLocation, location)).toMatchObject(
      { status: 'paused' },
    );
    await t.run((ctx) =>
      ctx.db.patch(coverage._id, {
        displayName: '',
        jurisdictionType: '',
        stateCode: undefined,
        officialWebsiteUrl: undefined,
        directoryUrls: [],
        districtDirectoryUrls: [],
        status: 'legacy',
      }),
    );
    expect(
      await t.mutation(internal.government.ensureCoverageForJurisdiction, {
        jurisdictionName: 'Denver, CO',
        desiredStatus: 'pilot',
      }),
    ).toMatchObject({
      displayName: 'Denver, CO',
      jurisdictionType: 'city',
      stateCode: 'CO',
      status: 'pilot',
    });
    expect(
      await t.query(internal.government.getCoverageById, { coverageId: coverage._id }),
    ).toMatchObject({ status: 'pilot' });
    const remote = (await t.mutation(internal.government.ensureCoverageForJurisdiction, {
      jurisdictionName: 'Remote village',
      populationBand: 'under_50k',
    }))!;
    await t.run((ctx) =>
      ctx.db.patch(remote._id, { directoryUrls: [], districtDirectoryUrls: [] }),
    );
    expect(
      await t.mutation(internal.government.ensureCoverageForJurisdiction, {
        jurisdictionName: 'Remote village',
      }),
    ).toMatchObject({ jurisdictionType: 'town' });
  });

  it('upserts contact identities, filters inactive entries, sorts by confidence/freshness and exposes a bounded preview', async () => {
    const { t, coverage } = await setup();
    const contacts = [
      contact('Low', { confidence: 0.4, freshUntil: Date.now() - 1 }),
      contact('Fresh', { confidence: 0.9 }),
      contact('Fresher', {
        confidence: 0.9,
        freshUntil: Date.now() + 2000,
        email: 'council@denvergov.org',
        phone: '3035550100',
        districtLabel: '1',
        contactType: 'district_representative',
      }),
      contact('Fourth'),
      contact('Fifth'),
    ];
    const ids = await t.mutation(internal.government.saveDiscoveredContacts, {
      coverageId: coverage._id,
      contacts,
    });
    expect(
      await t.mutation(internal.government.saveDiscoveredContacts, {
        coverageId: coverage._id,
        contacts: [contact('Fresh', { confidence: 0.9, title: 'Updated office' })],
      }),
    ).toEqual([ids[1]]);
    await t.run((ctx) => ctx.db.patch(ids[4], { isActive: false }));
    const summary = await t.query(api.government.getJurisdictionSummaryForLocation, location);
    expect(summary).toMatchObject({
      contactCount: 4,
      freshContactCount: 3,
      lastContactSyncAt: Date.now(),
    });
    expect(summary.topContacts.map((c) => c.name)).toEqual(['Fresher', 'Fresh', 'Fourth', 'Low']);
    expect(summary.topContacts[0]).toMatchObject({
      email: 'council@denvergov.org',
      phone: '3035550100',
      districtLabel: '1',
    });
    expect(
      await t.query(internal.government.getCoverageContacts, {
        coverageId: coverage._id,
        contactType: 'municipal',
      }),
    ).toHaveLength(3);
    const preview = await t.query(internal.government.buildUnsignedOutreachPreview, {
      coverageId: coverage._id,
      sourceAction: 'report_to_city',
      hotspot,
    });
    expect(preview?.body).toContain('Updated office');
    await t.run((ctx) => ctx.db.delete(coverage._id));
    expect(
      await t.query(internal.government.getCoverageById, { coverageId: coverage._id }),
    ).toBeNull();
    expect(
      await t.query(internal.government.buildUnsignedOutreachPreview, {
        coverageId: coverage._id,
        sourceAction: 'send_to_rep',
        hotspot,
      }),
    ).toBeNull();
  });
});

describe('government lead ownership and normalization', () => {
  it.each([
    [{ workEmail: 'bad' }, 'valid work email'],
    [{ workEmail: '@host.gov' }, 'valid work email'],
    [{ workEmail: 'name@' }, 'valid work email'],
    [{ jurisdictionName: ' ' }, 'Jurisdiction name'],
    [{ roleTitle: ' ' }, 'Role or title'],
  ])('rolls back invalid lead submissions', async (fields, message) => {
    const { t, owner } = await setup();
    await expect(
      t.mutation(api.government.submitGovernmentLead, {
        ...lead,
        ...fields,
        sessionToken: owner.sessionToken,
      }),
    ).rejects.toThrow(message);
    expect(await t.run((ctx) => ctx.db.query('governmentLeads').collect())).toEqual([]);
    expect(
      await t.query(api.organizations.getCurrentOrganizationContext, {
        sessionToken: owner.sessionToken,
      }),
    ).toBeNull();
  });

  it('keeps anonymous hub empty, then clips lead fields and derives organization context without claiming a signed city', async () => {
    const { t, owner } = await setup();
    expect(
      await t.query(api.government.getGovernmentHubContext, { sessionToken: 'bad' }),
    ).toBeNull();
    expect(
      await t.query(api.government.getGovernmentHubContext, { sessionToken: owner.sessionToken }),
    ).toEqual({ coverage: null, latestLead: null });
    await t.mutation(api.organizations.bootstrapCurrentOrganization, {
      sessionToken: owner.sessionToken,
    });
    expect(
      await t.query(api.government.getGovernmentHubContext, { sessionToken: owner.sessionToken }),
    ).toEqual({ coverage: null, latestLead: null });
    const result = await t.mutation(api.government.submitGovernmentLead, {
      ...lead,
      sessionToken: owner.sessionToken,
      workEmail: ' STAFF@DenverGov.Org ',
      roleTitle: 'x'.repeat(140),
      phone: '1'.repeat(50),
      notes: 'n'.repeat(1600),
      populationBand: 'under_50k',
      requestedFeature: 'review_threads',
      hotspotId: 'hotspot',
      reportId: 'report',
      designId: 'design',
    });
    expect(result).toMatchObject({
      created: true,
      status: 'new',
      coverage: { status: 'outreach', isSigned: false },
    });
    expect(await t.run((ctx) => ctx.db.get(result.leadId))).toMatchObject({
      normalizedWorkEmail: 'staff@denvergov.org',
      roleTitle: 'x'.repeat(120),
      phone: '1'.repeat(32),
      notes: 'n'.repeat(1500),
    });
    const context = (await t.query(api.organizations.getCurrentOrganizationContext, {
      sessionToken: owner.sessionToken,
    }))!;
    expect(context).toMatchObject({
      jurisdictionName: 'Denver, CO',
      organizationType: 'town',
      populationBand: 'under_50k',
    });
    expect(
      (await t.query(api.government.getGovernmentHubContext, { sessionToken: owner.sessionToken }))
        ?.latestLead,
    ).toMatchObject({
      leadId: result.leadId,
      submissionCount: 1,
      requestedFeature: 'review_threads',
    });
    await t.run((ctx) => ctx.db.patch(context.organizationId, { jurisdictionName: undefined }));
    expect(
      (await t.query(api.government.getGovernmentHubContext, { sessionToken: owner.sessionToken }))
        ?.coverage?.slug,
    ).toBe('denver-co');
    await t.run(async (ctx) => {
      const member = await ctx.db.query('organizationMembers').first();
      await ctx.db.delete(member!._id);
    });
    expect(
      (await t.query(api.government.getGovernmentHubContext, { sessionToken: owner.sessionToken }))
        ?.latestLead?.leadId,
    ).toBe(result.leadId);
  });

  it('merges only the same submitting user’s lead, retains omitted details and reopens closed/legacy statuses', async () => {
    const { t, owner } = await setup();
    const args = { ...lead, sessionToken: owner.sessionToken };
    const first = await t.mutation(api.government.submitGovernmentLead, {
      ...args,
      phone: '3035550100',
      notes: 'Original',
      requestedFeature: 'private_workspaces',
    });
    await t.run((ctx) =>
      ctx.db.patch(first.leadId, { status: 'closed', organizationId: undefined }),
    );
    const second = await t.mutation(api.government.submitGovernmentLead, args);
    expect(second).toMatchObject({ leadId: first.leadId, created: false, status: 'new' });
    expect(await t.run((ctx) => ctx.db.get(first.leadId))).toMatchObject({
      phone: '3035550100',
      notes: 'Original',
      requestedFeature: 'private_workspaces',
      submissionCount: 2,
    });
    await t.run((ctx) => ctx.db.patch(first.leadId, { status: 'legacy' }));
    expect(
      await t.mutation(api.government.submitGovernmentLead, {
        ...args,
        populationBand: '50k_to_500k',
        phone: '3035550200',
        notes: 'Updated',
        requestedFeature: 'exports',
        hotspotId: 'h2',
        reportId: 'r2',
        designId: 'd2',
      }),
    ).toMatchObject({ leadId: first.leadId, created: false, status: 'new' });
    const attacker = await t.mutation(api.users.createAnonymousUser, {});
    const malicious = await t.mutation(api.government.submitGovernmentLead, {
      ...args,
      sessionToken: attacker.sessionToken,
      roleTitle: 'Impersonator',
      notes: 'Overwrite',
    });
    expect(malicious.leadId).not.toBe(first.leadId);
    expect(await t.run((ctx) => ctx.db.get(first.leadId))).toMatchObject({
      roleTitle: 'Planner',
      notes: 'Updated',
      submittedByUserId: owner.user._id,
      submissionCount: 3,
    });
    expect(
      (
        await t.query(api.government.getGovernmentHubContext, {
          sessionToken: attacker.sessionToken,
        })
      )?.latestLead?.leadId,
    ).toBe(malicious.leadId);
    expect(await t.mutation(api.government.submitGovernmentLead, args)).toMatchObject({
      leadId: first.leadId,
      created: false,
    });
  });
});

describe('discovery jobs and queued outreach', () => {
  it('deduplicates queued jobs by scope and records attempts, completion/failure, and missing jobs', async () => {
    const { t, owner, coverage } = await setup();
    const args = {
      coverageId: coverage._id,
      officeScope: 'municipal',
      trigger: 'hotspot_action',
      requestedByUserId: owner.user._id,
      hotspotId: 'h1',
    };
    const first = (await t.mutation(internal.government.queueContactDiscoveryJob, args))!;
    expect((await t.mutation(internal.government.queueContactDiscoveryJob, args))?._id).toBe(
      first._id,
    );
    const both = (await t.mutation(internal.government.queueContactDiscoveryJob, {
      ...args,
      officeScope: 'both',
    }))!;
    expect(
      (
        await t.mutation(internal.government.queueContactDiscoveryJob, {
          ...args,
          officeScope: 'district_representative',
        })
      )?._id,
    ).toBe(both._id);
    expect(
      await t.mutation(internal.government.updateContactDiscoveryJob, {
        jobId: first._id,
        status: 'running',
      }),
    ).toMatchObject({ attempts: 1, startedAt: Date.now() });
    vi.setSystemTime(Date.now() + 1000);
    expect(
      await t.mutation(internal.government.updateContactDiscoveryJob, {
        jobId: first._id,
        status: 'completed',
      }),
    ).toMatchObject({ attempts: 1, completedAt: Date.now() });
    expect(
      await t.mutation(internal.government.updateContactDiscoveryJob, {
        jobId: both._id,
        status: 'failed',
        errorMessage: 'No contacts',
      }),
    ).toMatchObject({ attempts: 0, errorMessage: 'No contacts', completedAt: Date.now() });
    expect(
      await t.mutation(internal.government.updateContactDiscoveryJob, {
        jobId: both._id,
        status: 'queued',
      }),
    ).toMatchObject({ status: 'queued' });
    await t.run((ctx) => ctx.db.delete(first._id));
    expect(
      await t.mutation(internal.government.updateContactDiscoveryJob, {
        jobId: first._id,
        status: 'running',
      }),
    ).toBeNull();
  });

  it('merges identical open requests monotonically but separates users, references, actions, jurisdictions and sent requests', async () => {
    const { t, owner, coverage } = await setup();
    const args = {
      requestedByUserId: owner.user._id,
      coverageId: coverage._id,
      sourceAction: 'report_to_city',
      status: 'invalid',
      jurisdictionName: 'Denver',
      officeTargets: [],
      recipientContactIds: [],
      subject: 'Draft',
      body: 'Body',
      summary: 'Summary',
    };
    const first = (await t.mutation(internal.government.createOutreachRequest, args))!;
    expect(first.status).toBe('collecting_contacts');
    for (const status of ['blocked', 'queued_review', 'ready', 'collecting_contacts']) {
      expect(
        await t.mutation(internal.government.createOutreachRequest, { ...args, status }),
      ).toMatchObject({
        _id: first._id,
        status: status === 'collecting_contacts' ? 'ready' : status,
      });
    }
    for (const extra of [
      { hotspotId: 'h' },
      { reportId: 'r' },
      { designId: 'd' },
      { sourceAction: 'send_to_rep' },
    ])
      expect(
        (await t.mutation(internal.government.createOutreachRequest, { ...args, ...extra }))?._id,
      ).not.toBe(first._id);
    const other = await t.mutation(api.users.createAnonymousUser, {});
    expect(
      (
        await t.mutation(internal.government.createOutreachRequest, {
          ...args,
          requestedByUserId: other.user._id,
        })
      )?._id,
    ).not.toBe(first._id);
    const otherCoverage = (await t.mutation(internal.government.ensureCoverageForJurisdiction, {
      jurisdictionName: 'Portland, OR',
    }))!;
    expect(
      (
        await t.mutation(internal.government.createOutreachRequest, {
          ...args,
          coverageId: otherCoverage._id,
        })
      )?._id,
    ).not.toBe(first._id);
    await t.mutation(internal.government.createOutreachRequest, { ...args, status: 'sent' });
    expect((await t.mutation(internal.government.createOutreachRequest, args))?._id).not.toBe(
      first._id,
    );
  });
});
