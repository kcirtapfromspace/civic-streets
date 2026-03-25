import { v } from 'convex/values';
import { internal } from './_generated/api';
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { ensureUser } from './users';

async function requireMembershipForProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
) {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const membership = await ctx.db
    .query('organizationMembers')
    .withIndex('by_org_user', (q) =>
      q.eq('organizationId', project.organizationId).eq('userId', userId),
    )
    .unique();

  if (!membership) {
    throw new Error('Not authorized for this project');
  }

  return { project, membership };
}

export const create = mutation({
  args: {
    sessionToken: v.string(),
    projectId: v.id('projects'),
    workspaceId: v.optional(v.id('workspaces')),
    targetType: v.union(
      v.literal('project'),
      v.literal('design'),
      v.literal('report'),
    ),
    targetId: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);
    const { project } = await requireMembershipForProject(
      ctx,
      args.projectId,
      user._id,
    );

    const now = Date.now();
    const threadId = await ctx.db.insert('reviewThreads', {
      organizationId: project.organizationId,
      workspaceId: args.workspaceId ?? project.workspaceId,
      projectId: project._id,
      authorUserId: user._id,
      status: 'open',
      targetType: args.targetType,
      targetId: args.targetId,
      title: args.title,
      body: args.body,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.organizations.logAuditEvent, {
      organizationId: project.organizationId,
      workspaceId: args.workspaceId ?? project.workspaceId,
      projectId: project._id,
      actorUserId: user._id,
      eventType: 'review_thread.created',
      entityType: 'review_thread',
      entityId: String(threadId),
      metadataJson: JSON.stringify({
        targetType: args.targetType,
        targetId: args.targetId ?? null,
      }),
    });

    return await ctx.db.get(threadId);
  },
});

export const resolve = mutation({
  args: {
    sessionToken: v.string(),
    threadId: v.id('reviewThreads'),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Review thread not found');
    }

    const membership = await ctx.db
      .query('organizationMembers')
      .withIndex('by_org_user', (q) =>
        q.eq('organizationId', thread.organizationId).eq('userId', user._id),
      )
      .unique();

    if (!membership) {
      throw new Error('Not authorized for this review thread');
    }

    await ctx.db.patch(thread._id, {
      status: 'resolved',
      updatedAt: Date.now(),
      resolvedAt: Date.now(),
    });

    await ctx.runMutation(internal.organizations.logAuditEvent, {
      organizationId: thread.organizationId,
      workspaceId: thread.workspaceId,
      projectId: thread.projectId,
      actorUserId: user._id,
      eventType: 'review_thread.resolved',
      entityType: 'review_thread',
      entityId: String(thread._id),
    });

    return await ctx.db.get(thread._id);
  },
});

export const listByProject = query({
  args: {
    sessionToken: v.string(),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_session', (q) => q.eq('sessionToken', args.sessionToken))
      .unique();
    if (!user) {
      return [];
    }

    const { project } = await requireMembershipForProject(
      ctx,
      args.projectId,
      user._id,
    );

    return await ctx.db
      .query('reviewThreads')
      .withIndex('by_project', (q) => q.eq('projectId', project._id))
      .order('desc')
      .take(100);
  },
});
