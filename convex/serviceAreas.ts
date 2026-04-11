import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';
import { ensureUser } from './users';

// ── Queries ─────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('serviceAreas')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', args.organizationId),
      )
      .collect();
  },
});

export const getById = query({
  args: {
    serviceAreaId: v.id('serviceAreas'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.serviceAreaId);
  },
});

export const getActiveByOrganization = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('serviceAreas')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', args.organizationId),
      )
      .collect();
    return all.filter((sa) => sa.isActive);
  },
});

// ── Mutations ───────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    sessionToken: v.string(),
    organizationId: v.id('organizations'),
    name: v.string(),
    areaType: v.string(),
    bounds: v.optional(
      v.object({
        south: v.number(),
        west: v.number(),
        north: v.number(),
        east: v.number(),
      }),
    ),
    geometry: v.optional(v.string()),
    bufferMeters: v.optional(v.number()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    // Verify user is a member of the organization
    const membership = await ctx.db
      .query('organizationMembers')
      .withIndex('by_org_user', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', user._id),
      )
      .unique();

    if (!membership) {
      throw new Error('Not authorized: you are not a member of this organization');
    }

    const now = Date.now();
    const serviceAreaId = await ctx.db.insert('serviceAreas', {
      organizationId: args.organizationId,
      name: args.name,
      areaType: args.areaType,
      bounds: args.bounds,
      geometry: args.geometry,
      bufferMeters: args.bufferMeters,
      color: args.color,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return serviceAreaId;
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    serviceAreaId: v.id('serviceAreas'),
    name: v.optional(v.string()),
    bounds: v.optional(
      v.object({
        south: v.number(),
        west: v.number(),
        north: v.number(),
        east: v.number(),
      }),
    ),
    geometry: v.optional(v.string()),
    bufferMeters: v.optional(v.number()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    const serviceArea = await ctx.db.get(args.serviceAreaId);
    if (!serviceArea) {
      throw new Error('Service area not found');
    }

    // Verify user is a member of the organization
    const membership = await ctx.db
      .query('organizationMembers')
      .withIndex('by_org_user', (q) =>
        q
          .eq('organizationId', serviceArea.organizationId)
          .eq('userId', user._id),
      )
      .unique();

    if (!membership) {
      throw new Error('Not authorized: you are not a member of this organization');
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.bounds !== undefined) updates.bounds = args.bounds;
    if (args.geometry !== undefined) updates.geometry = args.geometry;
    if (args.bufferMeters !== undefined) updates.bufferMeters = args.bufferMeters;
    if (args.color !== undefined) updates.color = args.color;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.serviceAreaId, updates);
    return await ctx.db.get(args.serviceAreaId);
  },
});

export const remove = mutation({
  args: {
    sessionToken: v.string(),
    serviceAreaId: v.id('serviceAreas'),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    const serviceArea = await ctx.db.get(args.serviceAreaId);
    if (!serviceArea) {
      throw new Error('Service area not found');
    }

    // Verify user is a member of the organization
    const membership = await ctx.db
      .query('organizationMembers')
      .withIndex('by_org_user', (q) =>
        q
          .eq('organizationId', serviceArea.organizationId)
          .eq('userId', user._id),
      )
      .unique();

    if (!membership) {
      throw new Error('Not authorized: you are not a member of this organization');
    }

    await ctx.db.delete(args.serviceAreaId);
    return { success: true };
  },
});

// ── Internal Mutations ──────────────────────────────────────────────────────

export const seedCTAServiceArea = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Check if a CTA org already exists by slug
    const existingOrg = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', 'cta-chicago'))
      .unique();

    let orgId = existingOrg?._id;

    if (!orgId) {
      // Create a system user to own the org (or use an existing one)
      let systemUser = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', 'system@curbwise.app'))
        .unique();

      if (!systemUser) {
        const userId = await ctx.db.insert('users', {
          displayName: 'Curbwise System',
          email: 'system@curbwise.app',
          reputation: 0,
          createdAt: now,
        });
        systemUser = await ctx.db.get(userId);
      }

      orgId = await ctx.db.insert('organizations', {
        ownerUserId: systemUser!._id,
        name: 'Chicago Transit Authority',
        slug: 'cta-chicago',
        organizationType: 'transit_agency',
        jurisdictionName: 'Chicago, IL',
        populationBand: 'over_500k_or_regional',
        contractTier: 'civic_free',
        procurementState: 'none',
        invoiceMode: 'self_serve',
        createdAt: now,
        updatedAt: now,
      });

      // Add system user as owner member
      await ctx.db.insert('organizationMembers', {
        organizationId: orgId,
        userId: systemUser!._id,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create bounding-box service area for the full CTA network
    const boundingBoxId = await ctx.db.insert('serviceAreas', {
      organizationId: orgId,
      name: 'CTA Service Area',
      areaType: 'bounding_box',
      bounds: {
        south: 41.65,
        west: -87.91,
        north: 42.07,
        east: -87.52,
      },
      color: '#00A1DE',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Create polygon service area for the CTA L train corridor
    // Simplified polygon roughly covering the CTA rail network footprint
    const ctaRailPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-87.752, 41.722], // south (95th/Dan Ryan)
          [-87.684, 41.722], // southeast
          [-87.617, 41.735], // east side (south Chicago branch)
          [-87.607, 41.780], // near Cottage Grove
          [-87.604, 41.830], // lakefront south
          [-87.612, 41.867], // loop east
          [-87.627, 41.886], // loop / river
          [-87.633, 41.910], // north of loop
          [-87.654, 41.940], // Ravenswood area
          [-87.660, 41.967], // near Lawrence
          [-87.678, 41.984], // near Damen/Brown Line
          [-87.688, 42.019], // near Howard
          [-87.709, 42.039], // Evanston/Purple Line
          [-87.752, 42.073], // northwest (Yellow Line terminus)
          [-87.808, 42.010], // northwest suburbs
          [-87.836, 41.966], // near O'Hare branch
          [-87.904, 41.983], // O'Hare terminus
          [-87.904, 41.961], // O'Hare south
          [-87.836, 41.940], // back toward city
          [-87.795, 41.917], // near Irving Park
          [-87.770, 41.874], // near Western/Blue Line
          [-87.745, 41.854], // near Kedzie
          [-87.780, 41.788], // southwest (Orange/Pink area)
          [-87.806, 41.752], // Midway area
          [-87.788, 41.722], // southwest corner
          [-87.752, 41.722], // close polygon
        ],
      ],
    };

    const polygonId = await ctx.db.insert('serviceAreas', {
      organizationId: orgId,
      name: 'CTA Rail Network',
      areaType: 'polygon',
      geometry: JSON.stringify(ctaRailPolygon),
      color: '#E31837',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      organizationId: orgId,
      boundingBoxServiceAreaId: boundingBoxId,
      polygonServiceAreaId: polygonId,
    };
  },
});
