import { internal } from './_generated/api';
import { query, mutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { ensureUser } from './users';
import { ensureOrganizationForUser } from './organizations';

// ── Mutations ───────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.optional(v.id('designs')),
    hotspotId: v.optional(v.id('hotspots')),
    repName: v.string(),
    repTitle: v.string(),
    repEmail: v.optional(v.string()),
    address: v.string(),
    subject: v.string(),
    body: v.string(),
    communityVotes: v.number(),
    supporterCount: v.number(),
    visibility: v.optional(v.union(v.literal('public'), v.literal('private'))),
    workspaceId: v.optional(v.id('workspaces')),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);
    const organizationContext = await ensureOrganizationForUser(ctx, user);

    const workspaceId = args.workspaceId ?? organizationContext.workspace._id;
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || workspace.organizationId !== organizationContext.organization._id) {
      throw new ConvexError('Not authorized to use this workspace');
    }

    // Input validation
    if (args.repName.length < 1 || args.repName.length > 200) {
      throw new ConvexError('Representative name must be 1-200 characters');
    }
    if (args.subject.length < 1 || args.subject.length > 500) {
      throw new ConvexError('Subject must be 1-500 characters');
    }
    if (args.body.length < 1 || args.body.length > 10000) {
      throw new ConvexError('Body must be 1-10000 characters');
    }

    // Validate referenced entities exist
    if (args.designId) {
      const design = await ctx.db.get(args.designId);
      if (!design || (design.userId !== user._id && design.visibility !== 'public')) {
        throw new ConvexError('Design not found');
      }
    }
    if (args.hotspotId) {
      const hotspot = await ctx.db.get(args.hotspotId);
      if (!hotspot) {
        throw new ConvexError('Hotspot not found');
      }
    }

    const now = Date.now();
    const reportId = await ctx.db.insert('reports', {
      userId: user._id,
      organizationId: organizationContext.organization._id,
      workspaceId,
      designId: args.designId,
      hotspotId: args.hotspotId,
      visibility: args.visibility ?? 'private',
      reviewStatus: 'draft',
      repName: args.repName,
      repTitle: args.repTitle,
      repEmail: args.repEmail,
      address: args.address,
      subject: args.subject,
      body: args.body,
      communityVotes: args.communityVotes,
      supporterCount: args.supporterCount,
      status: 'draft',
      createdAt: now,
    });

    const projectId = await ctx.db.insert('projects', {
      organizationId: organizationContext.organization._id,
      workspaceId,
      ownerUserId: user._id,
      name: args.subject,
      description: args.body.slice(0, 500),
      visibility: args.visibility ?? 'private',
      sourceType: 'report',
      linkedReportId: reportId,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(reportId, { projectId });

    await ctx.runMutation(internal.organizations.logAuditEvent, {
      organizationId: organizationContext.organization._id,
      workspaceId,
      projectId,
      actorUserId: user._id,
      eventType: 'report.created',
      entityType: 'report',
      entityId: String(reportId),
      metadataJson: JSON.stringify({
        designId: args.designId ?? null,
        hotspotId: args.hotspotId ?? null,
        visibility: args.visibility ?? 'private',
      }),
    });

    return reportId;
  },
});

export const markSent = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id('reports'),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError('Report not found');
    }

    if (report.userId !== user._id) {
      throw new ConvexError('Not authorized to update this report');
    }

    if (report.status !== 'draft') {
      throw new ConvexError('Report has already been sent');
    }

    await ctx.db.patch(args.reportId, {
      status: 'sent',
      sentAt: Date.now(),
    });

    return { success: true };
  },
});

export const updateStatus = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id('reports'),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    const validStatuses = ['draft', 'sent', 'delivered', 'responded'];
    if (!validStatuses.includes(args.status)) {
      throw new ConvexError(`Invalid status: ${args.status}`);
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError('Report not found');
    }

    if (report.userId !== user._id) {
      throw new ConvexError('Not authorized to update this report');
    }

    await ctx.db.patch(args.reportId, {
      status: args.status,
    });

    return { success: true };
  },
});

// ── Queries ─────────────────────────────────────────────────────────────────

// Public report listings show a summary, never private correspondence or
// internal workspace metadata. Missing/unknown visibility fails closed.
function publicReportSummary(report: Doc<'reports'>) {
  return {
    _id: report._id,
    userId: report.userId,
    designId: report.designId,
    hotspotId: report.hotspotId,
    visibility: 'public' as const,
    repName: report.repName,
    repTitle: report.repTitle,
    address: report.address,
    subject: report.subject,
    communityVotes: report.communityVotes,
    supporterCount: report.supporterCount,
    status: report.status,
    sentAt: report.sentAt,
    createdAt: report.createdAt,
  };
}

export const getById = query({
  args: {
    reportId: v.id('reports'),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = args.sessionToken
      ? await ensureUser(ctx, args.sessionToken)
      : null;
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;
    if (report.userId === user?._id) return report;
    return report.visibility === 'public' ? publicReportSummary(report) : null;
  },
});

export const listByUser = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);
    return await ctx.db
      .query('reports')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(100);
  },
});

export const listByDesign = query({
  args: { designId: v.id('designs') },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query('reports')
      .withIndex('by_design', (q) => q.eq('designId', args.designId))
      .order('desc')
      .take(100);

    return reports
      .filter((report) => report.visibility === 'public')
      .map(publicReportSummary);
  },
});
