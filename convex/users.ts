import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { Doc } from './_generated/dataModel';
import { QueryCtx, MutationCtx } from './_generated/server';

// ── Random Name Generator ───────────────────────────────────────────────────

const ADJECTIVES = ['Civic', 'Urban', 'Street', 'Metro', 'Transit'];
const ANIMALS = ['Fox', 'Otter', 'Hawk', 'Bear', 'Wolf', 'Deer'];

function generateDisplayName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj} ${animal} ${num}`;
}

// ── Internal Helper ─────────────────────────────────────────────────────────

/**
 * Validates a session token and returns the user doc.
 * Throws if the token is invalid or the user doesn't exist.
 */
export async function ensureUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
): Promise<Doc<'users'>> {
  if (!sessionToken || typeof sessionToken !== 'string') {
    throw new Error('Invalid session token');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_session', (q) => q.eq('sessionToken', sessionToken))
    .unique();

  if (!user) {
    throw new Error('Invalid session: user not found');
  }

  return user;
}

// ── Mutations ───────────────────────────────────────────────────────────────

export const createAnonymousUser = mutation({
  args: {},
  handler: async (ctx) => {
    const displayName = generateDisplayName();
    const sessionToken = crypto.randomUUID();
    const now = Date.now();

    const userId = await ctx.db.insert('users', {
      displayName,
      sessionToken,
      reputation: 0,
      createdAt: now,
    });

    const user = await ctx.db.get(userId);
    return { user, sessionToken };
  },
});

export const upgradeToAuthenticated = mutation({
  args: {
    sessionToken: v.string(),
    email: v.string(),
    authProvider: v.string(),
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    // Check if an authenticated user with this provider+id already exists
    const existingAuth = await ctx.db
      .query('users')
      .withIndex('by_auth', (q) =>
        q.eq('authProvider', args.authProvider).eq('authId', args.authId),
      )
      .unique();

    if (existingAuth && existingAuth._id !== user._id) {
      // Merge anonymous contributions into the existing authenticated account
      // Transfer hotspots
      const hotspots = await ctx.db
        .query('hotspots')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect();
      for (const hotspot of hotspots) {
        await ctx.db.patch(hotspot._id, { userId: existingAuth._id });
      }

      // Transfer designs
      const designs = await ctx.db
        .query('designs')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect();
      for (const design of designs) {
        await ctx.db.patch(design._id, { userId: existingAuth._id });
      }

      // Transfer reports
      const reports = await ctx.db
        .query('reports')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect();
      for (const report of reports) {
        await ctx.db.patch(report._id, { userId: existingAuth._id });
      }

      // Delete the anonymous user
      await ctx.db.delete(user._id);

      // Return a new session token for the authenticated user
      const newSessionToken = crypto.randomUUID();
      await ctx.db.patch(existingAuth._id, { sessionToken: newSessionToken });
      const updatedUser = await ctx.db.get(existingAuth._id);
      return { user: updatedUser, sessionToken: newSessionToken };
    }

    // Upgrade the current anonymous user in place
    await ctx.db.patch(user._id, {
      email: args.email,
      authProvider: args.authProvider,
      authId: args.authId,
    });

    const updatedUser = await ctx.db.get(user._id);
    return { user: updatedUser, sessionToken: args.sessionToken };
  },
});

export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);

    // Require at least email-authenticated to update profile
    if (!user.email) {
      throw new Error('Must be authenticated to update profile');
    }

    const updates: Partial<{ displayName: string; avatarUrl: string }> = {};
    if (args.displayName !== undefined) {
      if (args.displayName.length < 1 || args.displayName.length > 50) {
        throw new Error('Display name must be 1-50 characters');
      }
      updates.displayName = args.displayName;
    }
    if (args.avatarUrl !== undefined) {
      updates.avatarUrl = args.avatarUrl;
    }

    await ctx.db.patch(user._id, updates);
    return await ctx.db.get(user._id);
  },
});

// ── Queries ─────────────────────────────────────────────────────────────────

export const getBySession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null;
    return await ctx.db
      .query('users')
      .withIndex('by_session', (q) => q.eq('sessionToken', args.sessionToken))
      .unique();
  },
});

export const getById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    // Return only public info
    return {
      _id: user._id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      reputation: user.reputation,
      createdAt: user.createdAt,
    };
  },
});

export const getCurrentUser = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null;
    return await ctx.db
      .query('users')
      .withIndex('by_session', (q) => q.eq('sessionToken', args.sessionToken))
      .unique();
  },
});
