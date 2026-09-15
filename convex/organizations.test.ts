// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { getDefaultOrganizationContext } from './organizations';
import crons from './crons';
import schema from './schema';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
async function setup() {
  const t = convexTest(schema, modules);
  const owner = await t.mutation(api.users.createAnonymousUser, {});
  return { t, owner };
}
type Test = Awaited<ReturnType<typeof setup>>['t'];
async function addOrganization(
  t: Test,
  userId: Doc<'users'>['_id'],
  fields: Partial<Doc<'organizations'>> = {},
  member: { role?: string; updatedAt?: number } = {},
) {
  return await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert('organizations', {
      ownerUserId: userId,
      name: 'Pilot',
      slug: `pilot-${crypto.randomUUID()}`,
      organizationType: 'advocacy',
      populationBand: 'under_50k',
      contractTier: 'civic_free',
      procurementState: 'none',
      invoiceMode: 'self_serve',
      createdAt: 1,
      updatedAt: 1,
      ...fields,
    });
    const membershipId = await ctx.db.insert('organizationMembers', {
      organizationId,
      userId,
      role: 'owner',
      createdAt: 1,
      updatedAt: 1,
      ...member,
    });
    return { organizationId, membershipId };
  });
}

describe('organization provisioning and selection', () => {
  it('returns no context for invalid sessions, missing memberships or deleted organizations', async () => {
    const { t, owner } = await setup();
    expect(
      await t.query(api.organizations.getCurrentOrganizationContext, { sessionToken: 'bad' }),
    ).toBeNull();
    expect(
      await t.query(api.organizations.getCurrentOrganizationContext, {
        sessionToken: owner.sessionToken,
      }),
    ).toBeNull();
    const stale = await addOrganization(t, owner.user._id);
    await t.run((ctx) => ctx.db.delete(stale.organizationId));
    expect(
      await t.query(api.organizations.getCurrentOrganizationContext, {
        sessionToken: owner.sessionToken,
      }),
    ).toBeNull();
    await expect(
      t.mutation(api.organizations.bootstrapCurrentOrganization, { sessionToken: 'bad' }),
    ).rejects.toThrow('Invalid session');
  });

  it.each([
    ['Jane.Doe-test@example.test', 'Jane Doe test civic team'],
    ['@example.test', 'Friendly Neighbor civic studio'],
    [undefined, 'Friendly Neighbor civic studio'],
  ])('provisions stable owner/workspace defaults with a safe name from %s', async (email, name) => {
    const { t, owner } = await setup();
    await t.run((ctx) => ctx.db.patch(owner.user._id, { email, displayName: 'Friendly Neighbor' }));
    const first = await t.mutation(api.organizations.bootstrapCurrentOrganization, {
      sessionToken: owner.sessionToken,
    });
    const second = await t.mutation(api.organizations.bootstrapCurrentOrganization, {
      sessionToken: owner.sessionToken,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      name,
      organizationType: 'individual',
      memberRole: 'owner',
      workspaceName: 'Shared Workspace',
      contractTier: 'civic_free',
    });
    expect(await t.query(api.organizations.getBySlug, { slug: first.slug })).toMatchObject({
      _id: first.organizationId,
      name,
    });
    expect(await t.query(api.organizations.getBySlug, { slug: 'missing' })).toBeNull();
    expect(await t.run((ctx) => ctx.db.query('workspaces').collect())).toHaveLength(1);
  });

  it('uses an existing default workspace, falls back to the first, and provisions only when all are absent', async () => {
    const { t, owner } = await setup();
    const org = await addOrganization(t, owner.user._id);
    expect(
      await t.query(api.organizations.getCurrentOrganizationContext, {
        sessionToken: owner.sessionToken,
      }),
    ).toMatchObject({ workspaceId: null, workspaceName: null });
    const first = await t.mutation(api.organizations.bootstrapCurrentOrganization, {
      sessionToken: owner.sessionToken,
    });
    await t.run((ctx) => ctx.db.patch(first.workspaceId!, { isDefault: false }));
    expect(
      (
        await t.mutation(api.organizations.bootstrapCurrentOrganization, {
          sessionToken: owner.sessionToken,
        })
      ).workspaceId,
    ).toBe(first.workspaceId);
    const chosen = await t.run((ctx) =>
      ctx.db.insert('workspaces', {
        organizationId: org.organizationId,
        name: 'Default',
        slug: 'default',
        isDefault: true,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect(
      (
        await t.query(api.organizations.getCurrentOrganizationContext, {
          sessionToken: owner.sessionToken,
        })
      )?.workspaceId,
    ).toBe(chosen);
  });

  it.each([
    [
      { organizationType: 'individual', contractTier: 'agency_enterprise' },
      { organizationType: 'advocacy' },
      {},
      {},
    ],
    [{ contractTier: 'civic_free' }, { contractTier: 'agency_enterprise' }, {}, {}],
    [{ contractTier: 'unknown' }, { contractTier: 'city_standard' }, {}, {}],
    [{ contractTier: 'town_essential' }, { contractTier: 'city_standard' }, {}, {}],
    [{}, {}, { role: 'member' }, { role: 'admin' }],
    [{}, {}, { role: 'unknown' }, { role: 'billing_admin' }],
    [{}, {}, { role: 'billing_admin' }, { role: 'owner' }],
    [{ updatedAt: 1 }, { updatedAt: 2 }, {}, {}],
    [{}, {}, { updatedAt: 1 }, { updatedAt: 2 }],
  ])(
    'selects a workspace using organization scope, paid tier, role and recency precedence',
    async (a, b, memberA, memberB) => {
      const { t, owner } = await setup();
      await addOrganization(t, owner.user._id, a, memberA);
      const expected = await addOrganization(t, owner.user._id, b, memberB);
      const result = await t.run((ctx) => getDefaultOrganizationContext(ctx, owner.user._id));
      expect(result?.organization._id).toBe(expected.organizationId);
    },
  );

  it('resolves otherwise identical memberships deterministically', async () => {
    const { t, owner } = await setup();
    const a = await addOrganization(
      t,
      owner.user._id,
      { contractTier: 'unknown' },
      { role: 'unknown' },
    );
    const b = await addOrganization(
      t,
      owner.user._id,
      { contractTier: 'unknown' },
      { role: 'unknown' },
    );
    const expected = [a.organizationId, b.organizationId].sort((a, b) => a.localeCompare(b))[0];
    expect(
      (await t.run((ctx) => getDefaultOrganizationContext(ctx, owner.user._id)))?.organization._id,
    ).toBe(expected);
  });

  it('normalizes all editable profile fields, clears optional text and keeps a blank name unchanged', async () => {
    const { t, owner } = await setup();
    const args = { sessionToken: owner.sessionToken };
    const initial = await t.mutation(api.organizations.updateCurrentOrganizationProfile, args);
    const result = await t.mutation(api.organizations.updateCurrentOrganizationProfile, {
      ...args,
      name: '  Denver Team!!  ',
      organizationType: 'city',
      jurisdictionName: '  Denver, CO ',
      populationBand: 'over_500k_or_regional',
      procurementState: 'security_review',
      invoiceMode: 'purchase_order',
      purchaseOrderNumber: ' PO-42 ',
      contractRenewalDate: 123456,
    });
    expect(result).toMatchObject({
      organizationId: initial.organizationId,
      name: 'Denver Team!!',
      jurisdictionName: 'Denver, CO',
      populationBand: 'over_500k_or_regional',
      procurementState: 'security_review',
      invoiceMode: 'purchase_order',
      purchaseOrderNumber: 'PO-42',
      contractRenewalDate: 123456,
    });
    expect(result.slug).toMatch(/^denver-team-/);
    expect(
      await t.mutation(api.organizations.updateCurrentOrganizationProfile, {
        ...args,
        name: '   ',
        jurisdictionName: ' ',
        purchaseOrderNumber: ' ',
      }),
    ).toMatchObject({ name: 'Denver Team!!', jurisdictionName: null, purchaseOrderNumber: null });
  });

  it('denies ordinary members profile changes and allows billing administrators', async () => {
    const { t, owner } = await setup();
    const org = await addOrganization(t, owner.user._id, {}, { role: 'member' });
    await expect(
      t.mutation(api.organizations.updateCurrentOrganizationProfile, {
        sessionToken: owner.sessionToken,
        name: 'Hijack',
      }),
    ).rejects.toThrow('Not authorized');
    expect(await t.run((ctx) => ctx.db.get(org.organizationId))).toMatchObject({ name: 'Pilot' });
    await t.run((ctx) => ctx.db.patch(org.membershipId, { role: 'billing_admin' }));
    expect(
      await t.mutation(api.organizations.updateCurrentOrganizationProfile, {
        sessionToken: owner.sessionToken,
        name: 'New name',
      }),
    ).toMatchObject({ name: 'New name' });
    const event = await t.mutation(internal.organizations.logAuditEvent, {
      organizationId: org.organizationId,
      eventType: 'test.external',
      entityType: 'organization',
    });
    expect(event).toMatchObject({ organizationId: org.organizationId, eventType: 'test.external' });
    expect(event).not.toHaveProperty('actorUserId');
  });
});

describe('backend registration', () => {
  it('registers upload, geocoding and quota cleanup at bounded operational intervals', () => {
    // Convex's deployment serializer exists at runtime but is omitted from its public declaration.
    const jobs = JSON.parse((crons as typeof crons & { export(): string }).export());
    expect(Object.values(jobs)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'storage:cleanupUploads',
          schedule: { type: 'interval', minutes: 15 },
          args: [{}],
        }),
        expect.objectContaining({
          name: 'geocoding:cleanup',
          schedule: { type: 'interval', hours: 1 },
          args: [{}],
        }),
        expect.objectContaining({
          name: 'rateLimit:purgeOldRateLimits',
          schedule: { type: 'interval', hours: 6 },
          args: [{}],
        }),
      ]),
    );
    // Real Convex execution above depends on schema indexes and runtime registration.
    expect(Object.keys(jobs)).toHaveLength(3);
  });
});
