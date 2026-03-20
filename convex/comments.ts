import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { ensureUser } from './users';

// ── Mutations ───────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    sessionToken: v.string(),
    body: v.string(),
    hotspotId: v.optional(v.id('hotspots')),
    designId: v.optional(v.id('designs')),
    parentId: v.optional(v.id('comments')),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    // Must target either a hotspot or a design
    if (!args.hotspotId && !args.designId) {
      throw new Error('Comment must be on a hotspot or a design');
    }
    if (args.hotspotId && args.designId) {
      throw new Error('Comment must target exactly one of hotspot or design');
    }

    // Validate body
    if (args.body.length < 1 || args.body.length > 5000) {
      throw new Error('Comment body must be 1-5000 characters');
    }

    // Validate parent exists if provided
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) {
        throw new Error('Parent comment not found');
      }
    }

    // Validate target exists
    if (args.hotspotId) {
      const hotspot = await ctx.db.get(args.hotspotId);
      if (!hotspot) {
        throw new Error('Hotspot not found');
      }
    }
    if (args.designId) {
      const design = await ctx.db.get(args.designId);
      if (!design) {
        throw new Error('Design not found');
      }
    }

    const now = Date.now();
    const commentId = await ctx.db.insert('comments', {
      hotspotId: args.hotspotId,
      designId: args.designId,
      userId: user._id,
      parentId: args.parentId,
      body: args.body,
      upvotes: 0,
      createdAt: now,
    });

    // Increment the parent entity's commentCount
    if (args.hotspotId) {
      const hotspot = await ctx.db.get(args.hotspotId);
      if (hotspot) {
        await ctx.db.patch(args.hotspotId, {
          commentCount: hotspot.commentCount + 1,
          updatedAt: Date.now(),
        });
      }
    }
    if (args.designId) {
      const design = await ctx.db.get(args.designId);
      if (design) {
        await ctx.db.patch(args.designId, {
          commentCount: design.commentCount + 1,
          updatedAt: Date.now(),
        });
      }
    }

    return commentId;
  },
});

export const deleteComment = mutation({
  args: {
    sessionToken: v.string(),
    commentId: v.id('comments'),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.userId !== user._id) {
      throw new Error('Not authorized to delete this comment');
    }

    // Decrement the parent entity's commentCount
    if (comment.hotspotId) {
      const hotspot = await ctx.db.get(comment.hotspotId);
      if (hotspot) {
        await ctx.db.patch(comment.hotspotId, {
          commentCount: Math.max(0, hotspot.commentCount - 1),
          updatedAt: Date.now(),
        });
      }
    }
    if (comment.designId) {
      const design = await ctx.db.get(comment.designId);
      if (design) {
        await ctx.db.patch(comment.designId, {
          commentCount: Math.max(0, design.commentCount - 1),
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.delete(args.commentId);

    return { success: true };
  },
});

// ── Queries ─────────────────────────────────────────────────────────────────

export const listByHotspot = query({
  args: {
    hotspotId: v.id('hotspots'),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('comments')
      .withIndex('by_hotspot', (q) => q.eq('hotspotId', args.hotspotId))
      .order('desc')
      .paginate({
        numItems: args.paginationOpts.numItems,
        cursor: args.paginationOpts.cursor ?? null,
      });

    // Separate top-level comments and replies
    const topLevel = result.page.filter((c) => !c.parentId);
    const replies = result.page.filter((c) => c.parentId);

    // Sort top-level by upvotes desc, replies chronologically
    topLevel.sort((a, b) => b.upvotes - a.upvotes);
    replies.sort((a, b) => a.createdAt - b.createdAt);

    // Enrich with author info
    const enriched = await Promise.all(
      [...topLevel, ...replies].map(async (comment) => {
        const author = await ctx.db.get(comment.userId);
        return {
          ...comment,
          author: author
            ? {
                _id: author._id,
                displayName: author.displayName,
                avatarUrl: author.avatarUrl,
                reputation: author.reputation,
              }
            : null,
        };
      }),
    );

    return {
      page: enriched,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const listByDesign = query({
  args: {
    designId: v.id('designs'),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('comments')
      .withIndex('by_design', (q) => q.eq('designId', args.designId))
      .order('desc')
      .paginate({
        numItems: args.paginationOpts.numItems,
        cursor: args.paginationOpts.cursor ?? null,
      });

    const topLevel = result.page.filter((c) => !c.parentId);
    const replies = result.page.filter((c) => c.parentId);

    topLevel.sort((a, b) => b.upvotes - a.upvotes);
    replies.sort((a, b) => a.createdAt - b.createdAt);

    const enriched = await Promise.all(
      [...topLevel, ...replies].map(async (comment) => {
        const author = await ctx.db.get(comment.userId);
        return {
          ...comment,
          author: author
            ? {
                _id: author._id,
                displayName: author.displayName,
                avatarUrl: author.avatarUrl,
                reputation: author.reputation,
              }
            : null,
        };
      }),
    );

    return {
      page: enriched,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
