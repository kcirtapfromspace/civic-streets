import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { ensureUser } from './users';

// ── Design Votes Table ──────────────────────────────────────────────────────
// Note: designVotes table should be added to schema if not present.
// For now, we use a pattern similar to hotspotVotes.

// ── Mutations ───────────────────────────────────────────────────────────────

export const save = mutation({
  args: {
    sessionToken: v.string(),
    title: v.string(),
    description: v.string(),
    streetData: v.string(),
    beforeStreetData: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    address: v.optional(v.string()),
    prowagPass: v.boolean(),
    nactoPass: v.boolean(),
    errorCount: v.number(),
    warningCount: v.number(),
    templateId: v.optional(v.string()),
    hotspotId: v.optional(v.id('hotspots')),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    // Input validation
    if (args.title.length < 1 || args.title.length > 200) {
      throw new Error('Title must be 1-200 characters');
    }
    if (args.description.length > 5000) {
      throw new Error('Description must be at most 5000 characters');
    }
    if (args.lat !== undefined && (args.lat < -90 || args.lat > 90)) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (args.lng !== undefined && (args.lng < -180 || args.lng > 180)) {
      throw new Error('Longitude must be between -180 and 180');
    }

    // Validate streetData is valid JSON
    try {
      JSON.parse(args.streetData);
    } catch {
      throw new Error('streetData must be valid JSON');
    }
    if (args.beforeStreetData) {
      try {
        JSON.parse(args.beforeStreetData);
      } catch {
        throw new Error('beforeStreetData must be valid JSON');
      }
    }

    const now = Date.now();
    const designId = await ctx.db.insert('designs', {
      userId: user._id,
      title: args.title,
      description: args.description,
      streetData: args.streetData,
      beforeStreetData: args.beforeStreetData,
      lat: args.lat,
      lng: args.lng,
      address: args.address,
      prowagPass: args.prowagPass,
      nactoPass: args.nactoPass,
      errorCount: args.errorCount,
      warningCount: args.warningCount,
      upvotes: 0,
      commentCount: 0,
      templateId: args.templateId,
      hotspotId: args.hotspotId,
      createdAt: now,
      updatedAt: now,
    });

    // If linked to a hotspot, update the hotspot's designId
    if (args.hotspotId) {
      await ctx.db.patch(args.hotspotId, { designId });
    }

    return designId;
  },
});

export const vote = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.id('designs'),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    if (args.value !== 1 && args.value !== -1) {
      throw new Error('Vote value must be +1 or -1');
    }

    const design = await ctx.db.get(args.designId);
    if (!design) {
      throw new Error('Design not found');
    }

    // Since there is no designVotes table in the schema, we track votes
    // using the hotspotVotes table pattern. For Phase 0.5, we'll simply
    // increment/decrement the upvotes counter without per-user tracking.
    // TODO: Add designVotes table to schema for proper dedup
    await ctx.db.patch(args.designId, {
      upvotes: design.upvotes + args.value,
      updatedAt: Date.now(),
    });

    return { action: 'voted' };
  },
});

export const deleteDesign = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.id('designs'),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    const design = await ctx.db.get(args.designId);
    if (!design) {
      throw new Error('Design not found');
    }

    if (design.userId !== user._id) {
      throw new Error('Not authorized to delete this design');
    }

    // Soft delete: we remove the design from the database
    // In a production app you'd add a `deletedAt` field instead
    await ctx.db.delete(args.designId);

    return { success: true };
  },
});

// ── Queries ─────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('designs')
      .order('desc')
      .paginate({
        numItems: args.paginationOpts.numItems,
        cursor: args.paginationOpts.cursor ?? null,
      });

    // Sort by upvotes descending
    const sorted = [...result.page].sort((a, b) => b.upvotes - a.upvotes);

    return {
      page: sorted,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const getById = query({
  args: { designId: v.id('designs') },
  handler: async (ctx, args) => {
    const design = await ctx.db.get(args.designId);
    if (!design) return null;

    const author = await ctx.db.get(design.userId);
    return {
      ...design,
      author: author
        ? {
            _id: author._id,
            displayName: author.displayName,
            avatarUrl: author.avatarUrl,
            reputation: author.reputation,
          }
        : null,
    };
  },
});

export const getByBounds = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
  },
  handler: async (ctx, args) => {
    const designs = await ctx.db.query('designs').collect();

    return designs.filter(
      (d) =>
        d.lat !== undefined &&
        d.lng !== undefined &&
        d.lat >= args.minLat &&
        d.lat <= args.maxLat &&
        d.lng >= args.minLng &&
        d.lng <= args.maxLng,
    );
  },
});

export const getByHotspot = query({
  args: { hotspotId: v.id('hotspots') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('designs')
      .withIndex('by_hotspot', (q) => q.eq('hotspotId', args.hotspotId))
      .order('desc')
      .collect();
  },
});

export const getByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('designs')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();
  },
});
