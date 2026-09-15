// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const reportFields = {
  repName: 'Council office',
  repTitle: 'Council member',
  repEmail: 'office@example.test',
  address: 'Denver, CO',
  subject: 'Improve this crossing',
  body: 'Private resident correspondence.',
  communityVotes: 2,
  supporterCount: 3,
};

async function setup() {
  const t = convexTest(schema, modules);
  const owner = await t.mutation(api.users.createAnonymousUser, {});
  const outsider = await t.mutation(api.users.createAnonymousUser, {});
  const designId = await t.run((ctx) =>
    ctx.db.insert('designs', {
      userId: owner.user._id,
      title: 'Private street design',
      description: '',
      visibility: 'private',
      streetData: '{}',
      prowagPass: true,
      nactoPass: true,
      errorCount: 0,
      warningCount: 0,
      upvotes: 0,
      commentCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  const reports = await t.run(async (ctx) => {
    const create = (visibility?: string) =>
      ctx.db.insert('reports', {
        ...reportFields,
        userId: owner.user._id,
        designId,
        visibility,
        status: 'draft',
        createdAt: Date.now(),
      });
    return {
      privateId: await create('private'),
      publicId: await create('public'),
      legacyId: await create(),
    };
  });
  return { t, owner, outsider, designId, ...reports };
}

describe('private report access', () => {
  it('returns private correspondence only to the report owner', async () => {
    const { t, owner, outsider, privateId, legacyId } = await setup();
    for (const reportId of [privateId, legacyId]) {
      expect(await t.query(api.reports.getById, { reportId })).toBeNull();
      expect(
        await t.query(api.reports.getById, { reportId, sessionToken: outsider.sessionToken }),
      ).toBeNull();
      expect(
        await t.query(api.reports.getById, { reportId, sessionToken: owner.sessionToken }),
      ).toMatchObject({ body: reportFields.body, repEmail: reportFields.repEmail });
    }
  });

  it('derives the list owner from the session and rejects a forged user ID', async () => {
    const { t, owner, outsider } = await setup();
    expect(
      await t.query(api.reports.listByUser, { sessionToken: owner.sessionToken }),
    ).toHaveLength(3);
    expect(await t.query(api.reports.listByUser, { sessionToken: outsider.sessionToken })).toEqual(
      [],
    );
    await expect(
      t.query(api.reports.listByUser, {
        sessionToken: outsider.sessionToken,
        // @ts-expect-error Exploit regression: clients must not select another account.
        userId: owner.user._id,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(api.reports.listByUser, { sessionToken: 'invalid-session' }),
    ).rejects.toThrow('Invalid session');
  });

  it('does not expose private letter content or recipient contact details in public summaries', async () => {
    const { t, owner, outsider, publicId, designId } = await setup();
    const summary = await t.query(api.reports.getById, { reportId: publicId });
    expect(summary).toMatchObject({
      _id: publicId,
      subject: reportFields.subject,
      visibility: 'public',
    });
    for (const key of [
      'body',
      'repEmail',
      'repPhone',
      'workspaceId',
      'organizationId',
      'projectId',
    ]) {
      expect(summary).not.toHaveProperty(key);
    }
    expect(
      await t.query(api.reports.getById, {
        reportId: publicId,
        sessionToken: outsider.sessionToken,
      }),
    ).toEqual(summary);
    expect(await t.query(api.reports.listByDesign, { designId })).toEqual([summary]);
    expect(
      await t.query(api.reports.getById, { reportId: publicId, sessionToken: owner.sessionToken }),
    ).toMatchObject({ body: reportFields.body });
  });

  it('rejects an invalid session even when a report ID is known', async () => {
    const { t, privateId } = await setup();
    await expect(
      t.query(api.reports.getById, { reportId: privateId, sessionToken: 'invalid-session' }),
    ).rejects.toThrow('Invalid session');
  });

  it('rejects cross-account status writes without modifying the report', async () => {
    const { t, outsider, privateId } = await setup();
    await expect(
      t.mutation(api.reports.markSent, {
        sessionToken: outsider.sessionToken,
        reportId: privateId,
      }),
    ).rejects.toThrow('Not authorized');
    await expect(
      t.mutation(api.reports.updateStatus, {
        sessionToken: outsider.sessionToken,
        reportId: privateId,
        status: 'responded',
      }),
    ).rejects.toThrow('Not authorized');
    expect(await t.run((ctx) => ctx.db.get(privateId))).toMatchObject({ status: 'draft' });
  });

  it('preserves anonymous report creation and defaults correspondence to private', async () => {
    const { t, outsider } = await setup();
    const reportId = await t.mutation(api.reports.create, {
      ...reportFields,
      sessionToken: outsider.sessionToken,
    });
    const report = (await t.query(api.reports.getById, {
      reportId,
      sessionToken: outsider.sessionToken,
    })) as Doc<'reports'>;
    expect(report).toMatchObject({
      userId: outsider.user._id,
      visibility: 'private',
      body: reportFields.body,
    });
    expect(await t.query(api.reports.getById, { reportId })).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(report.projectId!))).toMatchObject({
      visibility: 'private',
    });
  });

  it('rejects a workspace belonging to another organization without persisting a report', async () => {
    const { t, owner, outsider } = await setup();
    const ownerReportId = await t.mutation(api.reports.create, {
      ...reportFields,
      sessionToken: owner.sessionToken,
    });
    const ownerReport = await t.run((ctx) => ctx.db.get(ownerReportId));
    await expect(
      t.mutation(api.reports.create, {
        ...reportFields,
        sessionToken: outsider.sessionToken,
        workspaceId: ownerReport!.workspaceId,
      }),
    ).rejects.toThrow('Not authorized to use this workspace');
    expect(await t.query(api.reports.listByUser, { sessionToken: outsider.sessionToken })).toEqual(
      [],
    );
  });

  it('rejects another user’s private design reference, while allowing public designs', async () => {
    const { t, outsider, designId } = await setup();
    await expect(
      t.mutation(api.reports.create, {
        ...reportFields,
        sessionToken: outsider.sessionToken,
        designId,
      }),
    ).rejects.toThrow('Design not found');
    await t.run((ctx) => ctx.db.patch(designId, { visibility: 'public' }));
    await expect(
      t.mutation(api.reports.create, {
        ...reportFields,
        sessionToken: outsider.sessionToken,
        designId,
      }),
    ).resolves.toBeTruthy();
  });

  it.each([
    [{ repName: '' }, 'Representative name'],
    [{ repName: 'a'.repeat(201) }, 'Representative name'],
    [{ subject: '' }, 'Subject'],
    [{ subject: 'a'.repeat(501) }, 'Subject'],
    [{ body: '' }, 'Body'],
    [{ body: 'a'.repeat(10001) }, 'Body'],
  ])(
    'rolls back report, project and organization provisioning after invalid input',
    async (fields, message) => {
      const { t, outsider } = await setup();
      await expect(
        t.mutation(api.reports.create, {
          ...reportFields,
          ...fields,
          sessionToken: outsider.sessionToken,
        }),
      ).rejects.toThrow(message);
      expect(
        await t.query(api.reports.listByUser, { sessionToken: outsider.sessionToken }),
      ).toEqual([]);
      expect(await t.run((ctx) => ctx.db.query('projects').take(1))).toEqual([]);
      expect(await t.run((ctx) => ctx.db.query('organizations').take(1))).toEqual([]);
      expect(await t.run((ctx) => ctx.db.query('auditEvents').take(1))).toEqual([]);
    },
  );

  it('creates a public report with the owner’s private design and records consistent project/audit links', async () => {
    const { t, owner, designId } = await setup();
    const hotspotId = await t.run((ctx) =>
      ctx.db.insert('hotspots', {
        userId: owner.user._id,
        title: 'Curb ramp',
        description: '',
        category: 'accessibility',
        severity: 'high',
        lat: 39.74,
        lng: -104.99,
        address: 'Denver',
        upvotes: 0,
        commentCount: 0,
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const id = await t.mutation(api.reports.create, {
      ...reportFields,
      sessionToken: owner.sessionToken,
      designId,
      hotspotId,
      visibility: 'public',
    });
    const saved = await t.run((ctx) => ctx.db.get(id));
    expect(saved).toMatchObject({
      designId,
      hotspotId,
      visibility: 'public',
      userId: owner.user._id,
    });
    expect(await t.run((ctx) => ctx.db.get(saved!.projectId!))).toMatchObject({
      linkedReportId: id,
      ownerUserId: owner.user._id,
      organizationId: saved!.organizationId,
      workspaceId: saved!.workspaceId,
      visibility: 'public',
    });
    expect(await t.run((ctx) => ctx.db.query('auditEvents').first())).toMatchObject({
      actorUserId: owner.user._id,
      entityId: id,
      eventType: 'report.created',
      projectId: saved!.projectId,
    });
    const publicResult = await t.query(api.reports.getById, { reportId: id });
    expect(publicResult).toMatchObject({ designId, hotspotId });
    expect(publicResult).not.toHaveProperty('body');
  });

  it('rejects removed design and hotspot references without creating orphan projects', async () => {
    const { t, owner, designId } = await setup();
    await t.run((ctx) => ctx.db.delete(designId));
    await expect(
      t.mutation(api.reports.create, {
        ...reportFields,
        sessionToken: owner.sessionToken,
        designId,
      }),
    ).rejects.toThrow('Design not found');
    const hotspotId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('hotspots', {
        userId: owner.user._id,
        title: 'Removed issue',
        description: '',
        category: 'other',
        severity: 'low',
        lat: 39.74,
        lng: -104.99,
        address: 'Denver',
        upvotes: 0,
        commentCount: 0,
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });
    await expect(
      t.mutation(api.reports.create, {
        ...reportFields,
        sessionToken: owner.sessionToken,
        hotspotId,
      }),
    ).rejects.toThrow('Hotspot not found');
    expect(await t.run((ctx) => ctx.db.query('projects').take(1))).toEqual([]);
  });

  it('allows owner lifecycle updates and rejects duplicate sent marking', async () => {
    const { t, owner, privateId } = await setup();
    await expect(
      t.mutation(api.reports.markSent, { reportId: privateId, sessionToken: owner.sessionToken }),
    ).resolves.toEqual({ success: true });
    const sent = await t.run((ctx) => ctx.db.get(privateId));
    expect(sent).toMatchObject({ status: 'sent', sentAt: expect.any(Number) });
    await expect(
      t.mutation(api.reports.markSent, { reportId: privateId, sessionToken: owner.sessionToken }),
    ).rejects.toThrow('already been sent');
    await expect(
      t.mutation(api.reports.updateStatus, {
        reportId: privateId,
        sessionToken: owner.sessionToken,
        status: 'responded',
      }),
    ).resolves.toEqual({ success: true });
    expect(await t.run((ctx) => ctx.db.get(privateId))).toMatchObject({
      status: 'responded',
      sentAt: sent!.sentAt,
    });
  });

  it('rejects unknown status values and handles removed report IDs without recreating them', async () => {
    const { t, owner, privateId } = await setup();
    await expect(
      t.mutation(api.reports.updateStatus, {
        reportId: privateId,
        sessionToken: owner.sessionToken,
        status: 'unknown-status',
      }),
    ).rejects.toThrow('Invalid status');
    expect(await t.run((ctx) => ctx.db.get(privateId))).toMatchObject({ status: 'draft' });
    await t.run((ctx) => ctx.db.delete(privateId));
    expect(await t.query(api.reports.getById, { reportId: privateId })).toBeNull();
    await expect(
      t.mutation(api.reports.markSent, { reportId: privateId, sessionToken: owner.sessionToken }),
    ).rejects.toThrow('Report not found');
    await expect(
      t.mutation(api.reports.updateStatus, {
        reportId: privateId,
        sessionToken: owner.sessionToken,
        status: 'sent',
      }),
    ).rejects.toThrow('Report not found');
  });
});
