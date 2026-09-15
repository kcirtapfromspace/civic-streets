// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const draft = {
  title: 'Crossing needs an accessible curb ramp',
  description: 'The curb blocks wheelchair access.',
  category: 'accessibility',
  severity: 'high',
  lat: 39.7392,
  lng: -104.9903,
  address: 'Denver, CO',
};

async function setup() {
  const t = convexTest(schema, modules);
  const owner = await t.mutation(api.users.createAnonymousUser, {});
  const neighbor = await t.mutation(api.users.createAnonymousUser, {});
  await t.run((ctx) => ctx.db.patch(owner.user._id, { reputation: 10 }));
  const hotspotId = await t.mutation(api.hotspots.create, {
    ...draft,
    sessionToken: owner.sessionToken,
  });
  return { t, owner, neighbor, hotspotId };
}

async function insertHotspot(
  t: Awaited<ReturnType<typeof setup>>['t'],
  userId: Id<'users'>,
  fields: Partial<Doc<'hotspots'>> = {},
) {
  vi.setSystemTime(Date.now() + 1);
  return t.run((ctx) =>
    ctx.db.insert('hotspots', {
      ...draft,
      userId,
      upvotes: 0,
      commentCount: 0,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...fields,
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('community voting and moderation', () => {
  it('adds, switches and removes votes without duplicating a user vote or drifting the total', async () => {
    const { t, owner, neighbor, hotspotId } = await setup();
    expect(
      await t.query(api.hotspots.getUserVote, { hotspotId, sessionToken: neighbor.sessionToken }),
    ).toBeNull();
    expect(
      await t.mutation(api.hotspots.vote, {
        hotspotId,
        sessionToken: neighbor.sessionToken,
        value: 1,
      }),
    ).toEqual({ action: 'voted' });
    await t.mutation(api.hotspots.vote, { hotspotId, sessionToken: owner.sessionToken, value: 1 });
    expect(await t.query(api.hotspots.getById, { hotspotId })).toMatchObject({ upvotes: 2 });
    expect(
      await t.mutation(api.hotspots.vote, {
        hotspotId,
        sessionToken: neighbor.sessionToken,
        value: -1,
      }),
    ).toEqual({ action: 'switched' });
    expect(await t.query(api.hotspots.getById, { hotspotId })).toMatchObject({ upvotes: 0 });
    expect(
      await t.query(api.hotspots.getUserVote, { hotspotId, sessionToken: owner.sessionToken }),
    ).toBe(1);
    expect(
      await t.query(api.hotspots.getUserVote, { hotspotId, sessionToken: neighbor.sessionToken }),
    ).toBe(-1);
    expect(
      await t.mutation(api.hotspots.vote, {
        hotspotId,
        sessionToken: neighbor.sessionToken,
        value: -1,
      }),
    ).toEqual({ action: 'removed' });
    expect(await t.query(api.hotspots.getById, { hotspotId })).toMatchObject({ upvotes: 1 });
    expect(
      await t.query(api.hotspots.getUserVote, { hotspotId, sessionToken: neighbor.sessionToken }),
    ).toBeNull();
    expect(await t.run((ctx) => ctx.db.query('hotspotVotes').take(10))).toHaveLength(1);
  });

  it.each([0, 2, NaN])(
    'rejects an invalid vote (%s) without changing vote totals',
    async (value) => {
      const { t, neighbor, hotspotId } = await setup();
      await expect(
        t.mutation(api.hotspots.vote, { hotspotId, sessionToken: neighbor.sessionToken, value }),
      ).rejects.toThrow('Vote value');
      expect(await t.query(api.hotspots.getById, { hotspotId })).toMatchObject({ upvotes: 0 });
      expect(await t.run((ctx) => ctx.db.query('hotspotVotes').take(1))).toEqual([]);
    },
  );

  it('handles removed reports and unknown sessions without creating orphan votes', async () => {
    const { t, neighbor, hotspotId } = await setup();
    for (const sessionToken of ['', 'unknown-session']) {
      expect(await t.query(api.hotspots.getUserVote, { hotspotId, sessionToken })).toBeNull();
      await expect(
        t.mutation(api.hotspots.vote, { hotspotId, sessionToken, value: 1 }),
      ).rejects.toThrow('Invalid session');
    }
    await t.run((ctx) => ctx.db.delete(hotspotId));
    await expect(
      t.mutation(api.hotspots.vote, { hotspotId, sessionToken: neighbor.sessionToken, value: 1 }),
    ).rejects.toThrow('Hotspot not found');
    expect(await t.query(api.hotspots.getById, { hotspotId })).toBeNull();
    expect(await t.run((ctx) => ctx.db.query('hotspotVotes').take(1))).toEqual([]);
  });

  it('permits the author and established moderators, but denies another resident below the moderation threshold', async () => {
    const { t, owner, neighbor, hotspotId } = await setup();
    await t.mutation(api.hotspots.updateStatus, {
      hotspotId,
      sessionToken: owner.sessionToken,
      status: 'acknowledged',
    });
    await t.run((ctx) => ctx.db.patch(neighbor.user._id, { reputation: 99 }));
    await expect(
      t.mutation(api.hotspots.updateStatus, {
        hotspotId,
        sessionToken: neighbor.sessionToken,
        status: 'resolved',
      }),
    ).rejects.toThrow('Not authorized');
    expect(await t.query(api.hotspots.getById, { hotspotId })).toMatchObject({
      status: 'acknowledged',
    });
    await t.run((ctx) => ctx.db.patch(neighbor.user._id, { reputation: 100 }));
    vi.setSystemTime(Date.now() + 1_000);
    await expect(
      t.mutation(api.hotspots.updateStatus, {
        hotspotId,
        sessionToken: neighbor.sessionToken,
        status: 'resolved',
      }),
    ).resolves.toEqual({ success: true });
    expect(await t.query(api.hotspots.getById, { hotspotId })).toMatchObject({
      status: 'resolved',
      updatedAt: Date.now(),
    });
  });

  it('rejects unknown status values and deleted targets', async () => {
    const { t, owner, hotspotId } = await setup();
    await expect(
      t.mutation(api.hotspots.updateStatus, {
        hotspotId,
        sessionToken: owner.sessionToken,
        status: 'officially-approved',
      }),
    ).rejects.toThrow('Invalid status');
    expect(await t.query(api.hotspots.getById, { hotspotId })).toMatchObject({ status: 'open' });
    await t.run((ctx) => ctx.db.delete(hotspotId));
    await expect(
      t.mutation(api.hotspots.updateStatus, {
        hotspotId,
        sessionToken: owner.sessionToken,
        status: 'resolved',
      }),
    ).rejects.toThrow('Hotspot not found');
  });
});

describe('report validation and duplicate boundaries', () => {
  it.each([
    [{ title: '   ' }, 'Title'],
    [{ title: 'a'.repeat(201) }, 'Title'],
    [{ description: 'a'.repeat(5001) }, 'Description'],
    [{ category: 'unapproved-category' }, 'valid report category'],
    [{ severity: 'emergency' }, 'valid report severity'],
    [{ clientMeta: { formDurationMs: 2_999 } }, 'more time'],
  ])('rejects invalid report content without consuming a quota record', async (fields, message) => {
    const { t, owner } = await setup();
    vi.setSystemTime(Date.now() + 31_000);
    await expect(
      t.mutation(api.hotspots.create, { ...draft, sessionToken: owner.sessionToken, ...fields }),
    ).rejects.toThrow(message);
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(10))).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query('rateLimits').take(10))).toHaveLength(1);
  });

  it('allows a different issue category at the same location and the same issue after the duplicate window expires', async () => {
    const { t, owner } = await setup();
    vi.setSystemTime(Date.now() + 31_000);
    await expect(
      t.mutation(api.hotspots.create, {
        ...draft,
        sessionToken: owner.sessionToken,
        category: 'speeding',
      }),
    ).resolves.toBeTruthy();
    vi.setSystemTime(Date.now() + 3_600_001);
    await expect(
      t.mutation(api.hotspots.create, { ...draft, sessionToken: owner.sessionToken }),
    ).resolves.toBeTruthy();
    expect(await t.query(api.hotspots.getByUser, { userId: owner.user._id })).toHaveLength(3);
  });
});

describe('public hotspot queries', () => {
  it('combines category, status and map filters without leaking another category or city', async () => {
    const { t, owner, hotspotId } = await setup();
    const secondId = await insertHotspot(t, owner.user._id, { upvotes: 5 });
    await insertHotspot(t, owner.user._id, { category: 'speeding', upvotes: 20 });
    await insertHotspot(t, owner.user._id, { status: 'resolved', upvotes: 10 });
    await insertHotspot(t, owner.user._id, { lat: 41.88, lng: -87.63 });
    const result = await t.query(api.hotspots.list, {
      category: 'accessibility',
      status: 'open',
      minLat: 39.7,
      maxLat: 39.8,
      minLng: -105.1,
      maxLng: -104.9,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(result.page.map((row) => row._id)).toEqual([secondId, hotspotId]);
    expect(result.isDone).toBe(true);
  });

  it('keeps pagination usable when a page has no matches', async () => {
    const { t, owner, hotspotId } = await setup();
    await insertHotspot(t, owner.user._id, { category: 'speeding' });
    const first = await t.query(api.hotspots.list, {
      category: 'accessibility',
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    const second = await t.query(api.hotspots.list, {
      category: 'accessibility',
      paginationOpts: { numItems: 1, cursor: first.continueCursor },
    });
    expect(second.page.map((row) => row._id)).toEqual([hotspotId]);
  });

  it('keeps legacy public reports readable when their author no longer exists', async () => {
    const { t, owner, hotspotId } = await setup();
    await t.run((ctx) => ctx.db.delete(owner.user._id));
    const result = await t.query(api.hotspots.getById, { hotspotId });
    expect(result).toMatchObject({ _id: hotspotId, author: null, title: draft.title });
  });

  it.each(['bounding_box', 'polygon'])(
    'returns only in-area public projections for a %s service area',
    async (areaType) => {
      const { t, owner, hotspotId } = await setup();
      await insertHotspot(t, owner.user._id, { lat: 41.88, lng: -87.63 });
      await t.run((ctx) =>
        ctx.db.patch(hotspotId, {
          photoExifData: [{ lat: 40.5, lng: -105.5, timestamp: 'private-time' }],
          locationVerification: { photoHasGps: true, status: 'verified' },
          upvotes: 2,
        }),
      );
      await t.mutation(api.organizations.bootstrapCurrentOrganization, {
        sessionToken: owner.sessionToken,
      });
      const areaId = await t.run(async (ctx) => {
        const organization = await ctx.db
          .query('organizations')
          .withIndex('by_owner_user', (q) => q.eq('ownerUserId', owner.user._id))
          .unique();
        return ctx.db.insert('serviceAreas', {
          organizationId: organization!._id,
          name: 'Denver pilot',
          areaType,
          bounds: { south: 39.7, west: -105.1, north: 39.8, east: -104.9 },
          geometry: JSON.stringify({
            type: 'Polygon',
            coordinates: [
              [
                [-105.1, 39.7],
                [-104.9, 39.7],
                [-104.9, 39.8],
                [-105.1, 39.8],
                [-105.1, 39.7],
              ],
            ],
          }),
          color: '#123456',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const rows = await t.query(api.hotspots.getByServiceArea, { serviceAreaId: areaId });
      expect(rows.map((row) => row._id)).toEqual([hotspotId]);
      expect(rows[0]).not.toHaveProperty('photoExifData');
      expect(rows[0]).not.toHaveProperty('locationVerification');
      expect(
        await t.query(api.hotspots.getHeatmapByServiceArea, { serviceAreaId: areaId }),
      ).toEqual([
        {
          lat: draft.lat,
          lng: draft.lng,
          weight: 3,
          category: draft.category,
          severity: draft.severity,
        },
      ]);
      await t.run((ctx) =>
        ctx.db.patch(areaId, {
          areaType: 'not-configured',
          bounds: undefined,
          geometry: undefined,
        }),
      );
      expect(await t.query(api.hotspots.getByServiceArea, { serviceAreaId: areaId })).toEqual([]);
      expect(
        await t.query(api.hotspots.getHeatmapByServiceArea, { serviceAreaId: areaId }),
      ).toEqual([]);
      await t.run((ctx) => ctx.db.delete(areaId));
      await expect(
        t.query(api.hotspots.getByServiceArea, { serviceAreaId: areaId }),
      ).rejects.toThrow('Service area not found');
      await expect(
        t.query(api.hotspots.getHeatmapByServiceArea, { serviceAreaId: areaId }),
      ).rejects.toThrow('Service area not found');
    },
  );
});
