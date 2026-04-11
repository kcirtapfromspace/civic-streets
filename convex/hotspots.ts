import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { ensureUser } from './users';
import { checkRateLimit } from './rateLimit';
import { resolveStorageUrls } from './storage';

// ── Mutations ───────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    sessionToken: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    severity: v.string(),
    lat: v.number(),
    lng: v.number(),
    address: v.string(),
    photoUrls: v.optional(v.array(v.string())),
    photoStorageIds: v.optional(v.array(v.id('_storage'))),
    photoExifData: v.optional(v.array(v.object({
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      timestamp: v.optional(v.string()),
      orientation: v.optional(v.number()),
    }))),
    locationVerification: v.optional(v.object({
      photoHasGps: v.boolean(),
      distanceMeters: v.optional(v.number()),
      status: v.string(),
    })),
    issueGroup: v.optional(v.string()),
    issueType: v.optional(v.string()),
    isBlocking: v.optional(v.boolean()),
    clientMeta: v.optional(v.object({
      userAgent: v.optional(v.string()),
      screenResolution: v.optional(v.string()),
      timezone: v.optional(v.string()),
      language: v.optional(v.string()),
      platform: v.optional(v.string()),
      formDurationMs: v.number(),
    })),
    honeypot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    // ── Anti-abuse checks ─────────────────────────────────────────────────

    // Honeypot check — silently return fake ID if bot detected
    if (args.honeypot) {
      return 'fake_bot_detected' as any;
    }

    // Form timing check — reject suspiciously fast submissions
    if (args.clientMeta?.formDurationMs !== undefined && args.clientMeta.formDurationMs < 3000) {
      throw new Error('Please take more time to fill out the report');
    }

    // Rate limiting
    await checkRateLimit(ctx, user._id, 'hotspot_create', user.reputation);

    // ── Input validation ──────────────────────────────────────────────────

    if (args.title.length < 1 || args.title.length > 200) {
      throw new Error('Title must be 1-200 characters');
    }
    if (args.description.length < 1 || args.description.length > 5000) {
      throw new Error('Description must be 1-5000 characters');
    }

    const validCategories = [
      'dangerous-intersection',
      'needs-bike-lane',
      'speeding',
      'poor-sidewalk',
      'transit-gap',
      'accessibility',
      'other',
    ];
    if (!validCategories.includes(args.category)) {
      throw new Error(`Invalid category: ${args.category}`);
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(args.severity)) {
      throw new Error(`Invalid severity: ${args.severity}`);
    }

    if (args.lat < -90 || args.lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (args.lng < -180 || args.lng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    // Chicago metro bounds
    if (args.lat < 41.6 || args.lat > 42.1) {
      throw new Error('Location must be within the Chicago metro area');
    }
    if (args.lng < -88.0 || args.lng > -87.4) {
      throw new Error('Location must be within the Chicago metro area');
    }

    // ── Duplicate detection ───────────────────────────────────────────────

    // Check for duplicate reports from this user (same area + category within 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const userRecentHotspots = await ctx.db
      .query('hotspots')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const duplicate = userRecentHotspots.find((h) => {
      if (h.createdAt < oneHourAgo) return false;
      if (h.category !== args.category) return false;
      // ~50m proximity check (rough: 0.0005 degrees ≈ 55m)
      const latDiff = Math.abs(h.lat - args.lat);
      const lngDiff = Math.abs(h.lng - args.lng);
      return latDiff < 0.0005 && lngDiff < 0.0005;
    });

    if (duplicate) {
      throw new Error('You already reported a similar issue nearby. Consider upvoting the existing report.');
    }

    // ── Photo requirement for new users ───────────────────────────────────

    const hasPhotos = (args.photoStorageIds && args.photoStorageIds.length > 0) ||
                      (args.photoUrls && args.photoUrls.length > 0);
    if (user.reputation < 10 && !hasPhotos) {
      throw new Error('New reporters must include at least one photo');
    }

    // ── Insert hotspot ────────────────────────────────────────────────────

    const now = Date.now();
    const hotspotId = await ctx.db.insert('hotspots', {
      userId: user._id,
      title: args.title,
      description: args.description,
      category: args.category,
      severity: args.severity,
      lat: args.lat,
      lng: args.lng,
      address: args.address,
      photoUrls: args.photoUrls,
      photoStorageIds: args.photoStorageIds,
      photoExifData: args.photoExifData,
      locationVerification: args.locationVerification,
      issueGroup: args.issueGroup,
      issueType: args.issueType,
      isBlocking: args.isBlocking,
      upvotes: 0,
      commentCount: 0,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });

    // ── Store report metadata ─────────────────────────────────────────────

    if (args.clientMeta) {
      await ctx.db.insert('reportMetadata', {
        hotspotId,
        userAgent: args.clientMeta.userAgent,
        screenResolution: args.clientMeta.screenResolution,
        timezone: args.clientMeta.timezone,
        language: args.clientMeta.language,
        platform: args.clientMeta.platform,
        formDurationMs: args.clientMeta.formDurationMs,
        createdAt: now,
      });
    }

    return hotspotId;
  },
});

export const vote = mutation({
  args: {
    sessionToken: v.string(),
    hotspotId: v.id('hotspots'),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    if (args.value !== 1 && args.value !== -1) {
      throw new Error('Vote value must be +1 or -1');
    }

    const hotspot = await ctx.db.get(args.hotspotId);
    if (!hotspot) {
      throw new Error('Hotspot not found');
    }

    // Check for existing vote
    const existingVote = await ctx.db
      .query('hotspotVotes')
      .withIndex('by_user_hotspot', (q) =>
        q.eq('userId', user._id).eq('hotspotId', args.hotspotId),
      )
      .unique();

    if (existingVote) {
      if (existingVote.value === args.value) {
        // Same vote again => remove it (toggle off)
        await ctx.db.delete(existingVote._id);
        await ctx.db.patch(args.hotspotId, {
          upvotes: hotspot.upvotes - args.value,
          updatedAt: Date.now(),
        });
        return { action: 'removed' };
      } else {
        // Opposite vote => switch
        await ctx.db.patch(existingVote._id, {
          value: args.value,
          createdAt: Date.now(),
        });
        // Swing by 2: remove old vote and add new one
        await ctx.db.patch(args.hotspotId, {
          upvotes: hotspot.upvotes + args.value * 2,
          updatedAt: Date.now(),
        });
        return { action: 'switched' };
      }
    } else {
      // New vote
      await ctx.db.insert('hotspotVotes', {
        hotspotId: args.hotspotId,
        userId: user._id,
        value: args.value,
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.hotspotId, {
        upvotes: hotspot.upvotes + args.value,
        updatedAt: Date.now(),
      });
      return { action: 'voted' };
    }
  },
});

export const updateStatus = mutation({
  args: {
    sessionToken: v.string(),
    hotspotId: v.id('hotspots'),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    const validStatuses = ['open', 'acknowledged', 'in-progress', 'resolved'];
    if (!validStatuses.includes(args.status)) {
      throw new Error(`Invalid status: ${args.status}`);
    }

    const hotspot = await ctx.db.get(args.hotspotId);
    if (!hotspot) {
      throw new Error('Hotspot not found');
    }

    // Only the author or high-rep users (reputation >= 100) can update status
    const isAuthor = hotspot.userId === user._id;
    const isHighRep = user.reputation >= 100;

    if (!isAuthor && !isHighRep) {
      throw new Error('Not authorized to update hotspot status');
    }

    await ctx.db.patch(args.hotspotId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Queries ─────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    minLat: v.optional(v.number()),
    maxLat: v.optional(v.number()),
    minLng: v.optional(v.number()),
    maxLng: v.optional(v.number()),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const q = ctx.db.query('hotspots').order('desc');

    const result = await q.paginate({
      numItems: args.paginationOpts.numItems,
      cursor: args.paginationOpts.cursor ?? null,
    });

    // Apply filters in memory (Convex doesn't support compound index filtering
    // across multiple fields easily, so we filter post-query)
    let filtered = result.page;

    if (args.category) {
      filtered = filtered.filter((h) => h.category === args.category);
    }
    if (args.status) {
      filtered = filtered.filter((h) => h.status === args.status);
    }
    if (
      args.minLat !== undefined &&
      args.maxLat !== undefined &&
      args.minLng !== undefined &&
      args.maxLng !== undefined
    ) {
      filtered = filtered.filter(
        (h) =>
          h.lat >= args.minLat! &&
          h.lat <= args.maxLat! &&
          h.lng >= args.minLng! &&
          h.lng <= args.maxLng!,
      );
    }

    // Sort by upvotes descending
    filtered.sort((a, b) => b.upvotes - a.upvotes);

    // Resolve storage URLs for backward compatibility
    const page = await Promise.all(
      filtered.map(async (h) => {
        if (h.photoStorageIds && h.photoStorageIds.length > 0) {
          const resolvedUrls = await resolveStorageUrls(ctx, h.photoStorageIds);
          return { ...h, photoUrls: resolvedUrls };
        }
        return h;
      }),
    );

    return {
      page,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const getById = query({
  args: { hotspotId: v.id('hotspots') },
  handler: async (ctx, args) => {
    const hotspot = await ctx.db.get(args.hotspotId);
    if (!hotspot) return null;

    // Resolve storage URLs for backward compatibility
    let photoUrls = hotspot.photoUrls;
    if (hotspot.photoStorageIds && hotspot.photoStorageIds.length > 0) {
      photoUrls = await resolveStorageUrls(ctx, hotspot.photoStorageIds);
    }

    // Include author info
    const author = await ctx.db.get(hotspot.userId);
    return {
      ...hotspot,
      photoUrls,
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
    // Fetch all hotspots and filter by bounds
    // For Phase 0.5 this is acceptable; for production, use a geo-index
    const hotspots = await ctx.db.query('hotspots').collect();

    const filtered = hotspots.filter(
      (h) =>
        h.lat >= args.minLat &&
        h.lat <= args.maxLat &&
        h.lng >= args.minLng &&
        h.lng <= args.maxLng,
    );

    // Resolve storage URLs for backward compatibility
    return Promise.all(
      filtered.map(async (h) => {
        if (h.photoStorageIds && h.photoStorageIds.length > 0) {
          const resolvedUrls = await resolveStorageUrls(ctx, h.photoStorageIds);
          return { ...h, photoUrls: resolvedUrls };
        }
        return h;
      }),
    );
  },
});

export const getByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const hotspots = await ctx.db
      .query('hotspots')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();

    // Resolve storage URLs for backward compatibility
    return Promise.all(
      hotspots.map(async (h) => {
        if (h.photoStorageIds && h.photoStorageIds.length > 0) {
          const resolvedUrls = await resolveStorageUrls(ctx, h.photoStorageIds);
          return { ...h, photoUrls: resolvedUrls };
        }
        return h;
      }),
    );
  },
});

export const getUserVote = query({
  args: {
    sessionToken: v.string(),
    hotspotId: v.id('hotspots'),
  },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_session', (q) => q.eq('sessionToken', args.sessionToken))
      .unique();

    if (!user) return null;

    const vote = await ctx.db
      .query('hotspotVotes')
      .withIndex('by_user_hotspot', (q) =>
        q.eq('userId', user._id).eq('hotspotId', args.hotspotId),
      )
      .unique();

    return vote ? vote.value : null;
  },
});
