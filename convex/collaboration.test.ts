// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const paginationOpts = { numItems: 20, cursor: null };
const draft = {
  title: 'Accessible crossing',
  description: '',
  streetData: '{}',
  prowagPass: true,
  nactoPass: false,
  errorCount: 0,
  warningCount: 1,
};
async function setup() {
  const t = convexTest(schema, modules);
  const owner = await t.mutation(api.users.createAnonymousUser, {});
  const other = await t.mutation(api.users.createAnonymousUser, {});
  const designId = await t.mutation(api.designs.save, {
    ...draft,
    sessionToken: owner.sessionToken,
  });
  const design = (await t.run((ctx) => ctx.db.get(designId)))!;
  const hotspotId = await t.run((ctx) =>
    ctx.db.insert('hotspots', {
      userId: owner.user._id,
      title: 'Crossing',
      description: '',
      category: 'other',
      severity: 'low',
      lat: 39.74,
      lng: -104.99,
      address: 'Denver',
      status: 'open',
      upvotes: 0,
      commentCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  return { t, owner, other, designId, design, hotspotId };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('design ownership and discovery', () => {
  it.each([
    [{ title: '' }, 'Title'],
    [{ title: 'x'.repeat(201) }, 'Title'],
    [{ description: 'x'.repeat(5001) }, 'Description'],
    [{ lat: -91 }, 'Latitude'],
    [{ lat: 91 }, 'Latitude'],
    [{ lat: NaN }, 'Latitude'],
    [{ lng: -181 }, 'Longitude'],
    [{ lng: 181 }, 'Longitude'],
    [{ lng: Infinity }, 'Longitude'],
    [{ streetData: '{' }, 'streetData'],
    [{ beforeStreetData: '{' }, 'beforeStreetData'],
  ])(
    'rolls back invalid design creation and its project/audit side effects',
    async (fields, message) => {
      const { t, other } = await setup();
      await expect(
        t.mutation(api.designs.save, { ...draft, ...fields, sessionToken: other.sessionToken }),
      ).rejects.toThrow(message);
      expect(await t.query(api.designs.getByUser, { userId: other.user._id })).toEqual([]);
      expect(
        await t.query(api.organizations.getCurrentOrganizationContext, {
          sessionToken: other.sessionToken,
        }),
      ).toBeNull();
    },
  );

  it('persists a complete design with consistent project, workspace, hotspot and audit links', async () => {
    const { t, owner, design, hotspotId } = await setup();
    const designId = await t.mutation(api.designs.save, {
      ...draft,
      sessionToken: owner.sessionToken,
      beforeStreetData: '[]',
      lat: -90,
      lng: 180,
      address: 'Boundary',
      templateId: 'accessibility',
      hotspotId,
      workspaceId: design.workspaceId,
      visibility: 'private',
    });
    const saved = (await t.run((ctx) => ctx.db.get(designId)))!;
    expect(saved).toMatchObject({
      lat: -90,
      lng: 180,
      beforeStreetData: '[]',
      visibility: 'private',
      hotspotId,
      workspaceId: design.workspaceId,
    });
    expect(await t.run((ctx) => ctx.db.get(saved.projectId!))).toMatchObject({
      linkedDesignId: designId,
      visibility: 'private',
      ownerUserId: owner.user._id,
      workspaceId: design.workspaceId,
    });
    expect(await t.run((ctx) => ctx.db.get(hotspotId))).toMatchObject({ designId });
    expect(await t.run((ctx) => ctx.db.query('auditEvents').collect())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: designId,
          projectId: saved.projectId,
          eventType: 'design.saved',
        }),
      ]),
    );
  });

  it('rejects foreign or deleted workspaces, invalid sessions and missing hotspot references', async () => {
    const { t, other, owner, design, hotspotId } = await setup();
    await expect(
      t.mutation(api.designs.save, {
        ...draft,
        sessionToken: other.sessionToken,
        workspaceId: design.workspaceId,
      }),
    ).rejects.toThrow('Not authorized to use this workspace');
    await t.run((ctx) => ctx.db.delete(design.workspaceId!));
    await expect(
      t.mutation(api.designs.save, {
        ...draft,
        sessionToken: owner.sessionToken,
        workspaceId: design.workspaceId,
      }),
    ).rejects.toThrow('Not authorized to use this workspace');
    await expect(t.mutation(api.designs.save, { ...draft, sessionToken: 'bad' })).rejects.toThrow(
      'Invalid session',
    );
    await t.run((ctx) => ctx.db.delete(hotspotId));
    await expect(
      t.mutation(api.designs.save, { ...draft, sessionToken: owner.sessionToken, hotspotId }),
    ).rejects.toThrow();
  });

  it('keeps private designs out of every public listing while allowing owner session access', async () => {
    const { t, owner, other, designId, hotspotId } = await setup();
    const privateId = await t.mutation(api.designs.save, {
      ...draft,
      sessionToken: owner.sessionToken,
      visibility: 'private',
      lat: 39.74,
      lng: -104.99,
      hotspotId,
    });
    expect(await t.query(api.designs.getById, { designId: privateId })).toBeNull();
    expect((await t.query(api.designs.list, { paginationOpts })).page.map((d) => d._id)).toEqual([
      designId,
    ]);
    expect(await t.query(api.designs.getByHotspot, { hotspotId })).toEqual([]);
    for (const sessionToken of [undefined, other.sessionToken])
      expect(
        (await t.query(api.designs.getByUser, { userId: owner.user._id, sessionToken })).map(
          (d) => d._id,
        ),
      ).toEqual([designId]);
    expect(
      await t.query(api.designs.getByUser, {
        userId: owner.user._id,
        sessionToken: owner.sessionToken,
      }),
    ).toHaveLength(2);
    await expect(
      t.query(api.designs.getByUser, { userId: owner.user._id, sessionToken: 'bad' }),
    ).rejects.toThrow('Invalid session');
    const bounds = { minLat: 39, maxLat: 40, minLng: -105, maxLng: -104 };
    expect(await t.query(api.designs.getByBounds, bounds)).toEqual([]);
    await t.run((ctx) => ctx.db.patch(designId, { lat: 39, lng: -104, hotspotId }));
    expect((await t.query(api.designs.getByBounds, bounds)).map((d) => d._id)).toEqual([designId]);
    expect((await t.query(api.designs.getByHotspot, { hotspotId })).map((d) => d._id)).toEqual([
      designId,
    ]);
    for (const fields of [
      { lat: 38 },
      { lat: 41 },
      { lat: 39, lng: -106 },
      { lng: -103 },
      { lng: undefined },
    ]) {
      await t.run((ctx) => ctx.db.patch(designId, fields));
      expect(await t.query(api.designs.getByBounds, bounds)).toEqual([]);
    }
  });

  it('sorts public designs by votes, redacts author secrets and tolerates removed authors', async () => {
    const { t, owner, other, designId } = await setup();
    vi.setSystemTime(Date.now() + 1);
    const second = await t.mutation(api.designs.save, {
      ...draft,
      sessionToken: other.sessionToken,
    });
    await t.mutation(api.designs.vote, { sessionToken: other.sessionToken, designId, value: 1 });
    expect((await t.query(api.designs.list, { paginationOpts })).page.map((d) => d._id)).toEqual([
      designId,
      second,
    ]);
    expect((await t.query(api.designs.getById, { designId }))?.author).not.toHaveProperty(
      'sessionToken',
    );
    await t.mutation(api.designs.vote, { sessionToken: owner.sessionToken, designId, value: -1 });
    expect(await t.query(api.designs.getById, { designId })).toMatchObject({ upvotes: 0 });
    await t.run((ctx) => ctx.db.delete(owner.user._id));
    expect(await t.query(api.designs.getById, { designId })).toMatchObject({ author: null });
  });

  it('denies private design voting by outsiders and enforces owner deletion', async () => {
    const { t, owner, other, designId } = await setup();
    await expect(
      t.mutation(api.designs.vote, { sessionToken: owner.sessionToken, designId, value: 0 }),
    ).rejects.toThrow('Vote value');
    await t.run((ctx) => ctx.db.patch(designId, { visibility: 'private' }));
    await expect(
      t.mutation(api.designs.vote, { sessionToken: other.sessionToken, designId, value: 1 }),
    ).rejects.toThrow('Design not found');
    await t.mutation(api.designs.vote, { sessionToken: owner.sessionToken, designId, value: 1 });
    await expect(
      t.mutation(api.designs.deleteDesign, { sessionToken: other.sessionToken, designId }),
    ).rejects.toThrow('Not authorized');
    expect(
      await t.mutation(api.designs.deleteDesign, { sessionToken: owner.sessionToken, designId }),
    ).toEqual({ success: true });
    expect(await t.query(api.designs.getById, { designId })).toBeNull();
    await expect(
      t.mutation(api.designs.deleteDesign, { sessionToken: owner.sessionToken, designId }),
    ).rejects.toThrow('Design not found');
    await expect(
      t.mutation(api.designs.vote, { sessionToken: owner.sessionToken, designId, value: 1 }),
    ).rejects.toThrow('Design not found');
  });
});

describe('comment discussions', () => {
  it('rejects ambiguous targets, invalid body lengths, removed references and unrelated parents', async () => {
    const { t, owner, designId, hotspotId } = await setup();
    const base = { sessionToken: owner.sessionToken, body: 'Hello' };
    await expect(t.mutation(api.comments.create, base)).rejects.toThrow('must be on');
    await expect(t.mutation(api.comments.create, { ...base, designId, hotspotId })).rejects.toThrow(
      'exactly one',
    );
    for (const body of ['', 'x'.repeat(5001)])
      await expect(t.mutation(api.comments.create, { ...base, body, hotspotId })).rejects.toThrow(
        '1-5000',
      );
    const parentId = await t.mutation(api.comments.create, { ...base, hotspotId });
    await expect(t.mutation(api.comments.create, { ...base, designId, parentId })).rejects.toThrow(
      'another discussion',
    );
    await t.mutation(api.comments.deleteComment, {
      sessionToken: owner.sessionToken,
      commentId: parentId,
    });
    await expect(t.mutation(api.comments.create, { ...base, hotspotId, parentId })).rejects.toThrow(
      'Parent comment not found',
    );
    await t.run(async (ctx) => {
      await ctx.db.delete(hotspotId);
      await ctx.db.delete(designId);
    });
    await expect(t.mutation(api.comments.create, { ...base, hotspotId })).rejects.toThrow(
      'Hotspot not found',
    );
    await expect(t.mutation(api.comments.create, { ...base, designId })).rejects.toThrow(
      'Design not found',
    );
  });

  it.each(['hotspot', 'design'] as const)(
    'orders %s discussion roots by votes and replies by creation, with safe authors and deletion counters',
    async (kind) => {
      const { t, owner, other, hotspotId, designId } = await setup();
      const target = kind === 'hotspot' ? { hotspotId } : { designId };
      const create = (body: string, parentId?: Doc<'comments'>['_id']) =>
        t.mutation(api.comments.create, {
          sessionToken: owner.sessionToken,
          body,
          ...target,
          parentId,
        });
      const first = await create('First root');
      vi.setSystemTime(Date.now() + 1);
      const second = await create('Popular root');
      vi.setSystemTime(Date.now() + 1);
      const reply = await create('Early reply', first);
      vi.setSystemTime(Date.now() + 1);
      const reply2 = await create('Later reply', second);
      await t.run((ctx) => ctx.db.patch(second, { upvotes: 5 }));
      const read = () =>
        kind === 'hotspot'
          ? t.query(api.comments.listByHotspot, { hotspotId, paginationOpts })
          : t.query(api.comments.listByDesign, { designId, paginationOpts });
      expect((await read()).page.map((c) => c._id)).toEqual([second, first, reply, reply2]);
      expect((await read()).page[0].author).not.toHaveProperty('sessionToken');
      expect(
        await t.run((ctx) => ctx.db.get(kind === 'hotspot' ? hotspotId : designId)),
      ).toMatchObject({ commentCount: 4 });
      await expect(
        t.mutation(api.comments.deleteComment, {
          sessionToken: other.sessionToken,
          commentId: first,
        }),
      ).rejects.toThrow('Not authorized');
      await t.mutation(api.comments.deleteComment, {
        sessionToken: owner.sessionToken,
        commentId: first,
      });
      expect(
        await t.run((ctx) => ctx.db.get(kind === 'hotspot' ? hotspotId : designId)),
      ).toMatchObject({ commentCount: 3 });
      await expect(
        t.mutation(api.comments.deleteComment, {
          sessionToken: owner.sessionToken,
          commentId: first,
        }),
      ).rejects.toThrow('Comment not found');
      await t.run((ctx) =>
        ctx.db.patch(kind === 'hotspot' ? hotspotId : designId, { commentCount: 0 }),
      );
      await t.mutation(api.comments.deleteComment, {
        sessionToken: owner.sessionToken,
        commentId: reply,
      });
      expect(
        await t.run((ctx) => ctx.db.get(kind === 'hotspot' ? hotspotId : designId)),
      ).toMatchObject({ commentCount: 0 });
      await t.run((ctx) => ctx.db.delete(owner.user._id));
      expect((await read()).page.every((c) => c.author === null)).toBe(true);
    },
  );

  it('limits private design discussions to their owner and safely deletes orphan comments', async () => {
    const { t, owner, other, designId, hotspotId } = await setup();
    await t.run((ctx) => ctx.db.patch(designId, { visibility: 'private' }));
    const commentId = await t.mutation(api.comments.create, {
      sessionToken: owner.sessionToken,
      designId,
      body: 'Private draft review',
    });
    await expect(
      t.mutation(api.comments.create, {
        sessionToken: other.sessionToken,
        designId,
        body: 'Intruder',
      }),
    ).rejects.toThrow('Design not found');
    for (const sessionToken of [undefined, other.sessionToken])
      expect(
        (await t.query(api.comments.listByDesign, { designId, paginationOpts, sessionToken })).page,
      ).toEqual([]);
    expect(
      (
        await t.query(api.comments.listByDesign, {
          designId,
          paginationOpts,
          sessionToken: owner.sessionToken,
        })
      ).page.map((c) => c._id),
    ).toEqual([commentId]);
    const hotspotComment = await t.mutation(api.comments.create, {
      sessionToken: owner.sessionToken,
      hotspotId,
      body: 'Public',
    });
    await t.run(async (ctx) => {
      await ctx.db.delete(designId);
      await ctx.db.delete(hotspotId);
    });
    expect((await t.query(api.comments.listByDesign, { designId, paginationOpts })).page).toEqual(
      [],
    );
    for (const id of [commentId, hotspotComment])
      expect(
        await t.mutation(api.comments.deleteComment, {
          sessionToken: owner.sessionToken,
          commentId: id,
        }),
      ).toEqual({ success: true });
  });
});

describe('organization review threads', () => {
  it('creates and resolves an authorized review with project-scoped audit records', async () => {
    const { t, owner, design } = await setup();
    const thread = (await t.mutation(api.reviewThreads.create, {
      sessionToken: owner.sessionToken,
      projectId: design.projectId!,
      targetType: 'project',
      title: 'Review',
      body: 'Check curb widths',
    }))!;
    expect(thread).toMatchObject({
      workspaceId: design.workspaceId,
      organizationId: design.organizationId,
      status: 'open',
      authorUserId: owner.user._id,
    });
    expect(
      await t.query(api.reviewThreads.listByProject, {
        sessionToken: owner.sessionToken,
        projectId: design.projectId!,
      }),
    ).toHaveLength(1);
    vi.setSystemTime(Date.now() + 1000);
    expect(
      await t.mutation(api.reviewThreads.resolve, {
        sessionToken: owner.sessionToken,
        threadId: thread._id,
      }),
    ).toMatchObject({ status: 'resolved', resolvedAt: Date.now() });
    const second = await t.mutation(api.reviewThreads.create, {
      sessionToken: owner.sessionToken,
      projectId: design.projectId!,
      workspaceId: design.workspaceId,
      targetType: 'design',
      targetId: String(design._id),
      title: 'Design',
      body: 'Review details',
    });
    const audit = await t.run((ctx) => ctx.db.query('auditEvents').collect());
    expect(audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'review_thread.created',
          entityId: second!._id,
          metadataJson: JSON.stringify({ targetType: 'design', targetId: design._id }),
        }),
        expect.objectContaining({ eventType: 'review_thread.resolved', entityId: thread._id }),
      ]),
    );
  });

  it('denies outsiders and unknown sessions, removed projects/threads and foreign workspaces', async () => {
    const { t, owner, other, design } = await setup();
    const args = {
      sessionToken: owner.sessionToken,
      projectId: design.projectId!,
      targetType: 'report' as const,
      title: 'Review',
      body: 'Private',
    };
    const thread = (await t.mutation(api.reviewThreads.create, args))!;
    expect(
      await t.query(api.reviewThreads.listByProject, {
        sessionToken: 'bad',
        projectId: design.projectId!,
      }),
    ).toEqual([]);
    await expect(
      t.query(api.reviewThreads.listByProject, {
        sessionToken: other.sessionToken,
        projectId: design.projectId!,
      }),
    ).rejects.toThrow('Not authorized');
    await expect(
      t.mutation(api.reviewThreads.create, { ...args, sessionToken: other.sessionToken }),
    ).rejects.toThrow('Not authorized');
    await expect(
      t.mutation(api.reviewThreads.resolve, {
        sessionToken: other.sessionToken,
        threadId: thread._id,
      }),
    ).rejects.toThrow('Not authorized');
    const otherOrg = await t.mutation(api.organizations.bootstrapCurrentOrganization, {
      sessionToken: other.sessionToken,
    });
    await expect(
      t.mutation(api.reviewThreads.create, { ...args, workspaceId: otherOrg.workspaceId! }),
    ).rejects.toThrow('Not authorized to use this workspace');
    await t.run((ctx) => ctx.db.delete(otherOrg.workspaceId!));
    await expect(
      t.mutation(api.reviewThreads.create, { ...args, workspaceId: otherOrg.workspaceId! }),
    ).rejects.toThrow('Not authorized to use this workspace');
    await t.run(async (ctx) => {
      await ctx.db.delete(thread._id);
      await ctx.db.delete(design.projectId!);
    });
    await expect(
      t.mutation(api.reviewThreads.resolve, {
        sessionToken: owner.sessionToken,
        threadId: thread._id,
      }),
    ).rejects.toThrow('Review thread not found');
    await expect(t.mutation(api.reviewThreads.create, args)).rejects.toThrow('Project not found');
    expect(await t.run((ctx) => ctx.db.query('reviewThreads').collect())).toEqual([]);
  });
});

describe('service areas', () => {
  it('supports member-scoped creation, optional updates, active filtering and deletion', async () => {
    const { t, owner, other, design } = await setup();
    const organizationId = design.organizationId!;
    const base = {
      sessionToken: owner.sessionToken,
      organizationId,
      name: 'Pilot',
      areaType: 'bounding_box',
    };
    const first = await t.mutation(api.serviceAreas.create, base);
    const bounds = { south: 39, west: -105, north: 40, east: -104 };
    const second = await t.mutation(api.serviceAreas.create, {
      ...base,
      isActive: false,
      bounds,
      geometry: '{}',
      bufferMeters: 0,
      color: '#000',
    });
    expect(await t.query(api.serviceAreas.list, { organizationId })).toHaveLength(2);
    expect(
      (await t.query(api.serviceAreas.getActiveByOrganization, { organizationId })).map(
        (a) => a._id,
      ),
    ).toEqual([first]);
    expect(
      await t.mutation(api.serviceAreas.update, {
        sessionToken: owner.sessionToken,
        serviceAreaId: first,
      }),
    ).toMatchObject({ name: 'Pilot', isActive: true });
    expect(
      await t.mutation(api.serviceAreas.update, {
        sessionToken: owner.sessionToken,
        serviceAreaId: first,
        name: 'Changed',
        bounds,
        geometry: '[]',
        bufferMeters: 100,
        color: '#fff',
        isActive: false,
      }),
    ).toMatchObject({
      name: 'Changed',
      bounds,
      geometry: '[]',
      bufferMeters: 100,
      color: '#fff',
      isActive: false,
    });
    await expect(
      t.mutation(api.serviceAreas.create, { ...base, sessionToken: other.sessionToken }),
    ).rejects.toThrow('Not authorized');
    await expect(
      t.mutation(api.serviceAreas.update, {
        sessionToken: other.sessionToken,
        serviceAreaId: first,
        name: 'Hijack',
      }),
    ).rejects.toThrow('Not authorized');
    await expect(
      t.mutation(api.serviceAreas.remove, {
        sessionToken: other.sessionToken,
        serviceAreaId: first,
      }),
    ).rejects.toThrow('Not authorized');
    expect(
      await t.mutation(api.serviceAreas.remove, {
        sessionToken: owner.sessionToken,
        serviceAreaId: first,
      }),
    ).toEqual({ success: true });
    expect(await t.query(api.serviceAreas.getById, { serviceAreaId: first })).toBeNull();
    expect(await t.query(api.serviceAreas.getById, { serviceAreaId: second })).toMatchObject({
      isActive: false,
    });
    await expect(
      t.mutation(api.serviceAreas.update, {
        sessionToken: owner.sessionToken,
        serviceAreaId: first,
      }),
    ).rejects.toThrow('Service area not found');
    await expect(
      t.mutation(api.serviceAreas.remove, {
        sessionToken: owner.sessionToken,
        serviceAreaId: first,
      }),
    ).rejects.toThrow('Service area not found');
  });

  it.each([false, true])(
    'seeds public CTA geometry and reuses the existing system user (%s)',
    async (existingUser) => {
      const t = convexTest(schema, modules);
      if (existingUser)
        await t.run((ctx) =>
          ctx.db.insert('users', {
            email: 'system@curbwise.app',
            displayName: 'System',
            reputation: 0,
            createdAt: Date.now(),
          }),
        );
      const seeded = await t.mutation(internal.serviceAreas.seedCTAServiceArea, {});
      const areas = await t.query(api.serviceAreas.list, { organizationId: seeded.organizationId });
      expect(areas.map((a) => a.areaType).sort()).toEqual(['bounding_box', 'polygon']);
      expect(JSON.parse(areas.find((a) => a.areaType === 'polygon')!.geometry!).type).toBe(
        'Polygon',
      );
      expect(await t.run((ctx) => ctx.db.query('users').collect())).toHaveLength(1);
      expect((await t.mutation(internal.serviceAreas.seedCTAServiceArea, {})).organizationId).toBe(
        seeded.organizationId,
      );
      expect(await t.run((ctx) => ctx.db.query('organizations').collect())).toHaveLength(1);
    },
  );
});
