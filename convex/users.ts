import { query, mutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';
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
    throw new ConvexError('Invalid session');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_session', (q) => q.eq('sessionToken', sessionToken))
    .unique();

  if (!user) {
    throw new ConvexError('Invalid session');
  }

  return user;
}

// These projections are deliberate allowlists. Never return a raw user document
// from a public function: sessionToken, authProvider and authId are private.
function publicProfile(user: Doc<'users'>) {
  return {
    _id: user._id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    reputation: user.reputation,
    createdAt: user.createdAt,
  };
}

const publicProfileValidator = v.object({
  _id: v.id('users'),
  displayName: v.string(),
  avatarUrl: v.optional(v.string()),
  reputation: v.number(),
  createdAt: v.number(),
});

const sessionUserValidator = v.object({
  ...publicProfileValidator.fields,
  email: v.optional(v.string()),
  isAuthenticated: v.literal(false),
});

function sessionUser(user: Doc<'users'>) {
  return {
    ...publicProfile(user),
    // Legacy email values are contact data, never evidence of a verified login.
    email: user.email,
    isAuthenticated: false as const,
  };
}

export type SessionUser = ReturnType<typeof sessionUser>;

async function findSessionUser(ctx: QueryCtx, sessionToken: string) {
  if (!sessionToken) return null;
  const user = await ctx.db
    .query('users')
    .withIndex('by_session', (q) => q.eq('sessionToken', sessionToken))
    .unique();
  return user ? sessionUser(user) : null;
}

const VERIFIED_SIGN_IN_UNAVAILABLE =
  'Verified account sign-in is not available yet. You can continue reporting with your anonymous session.';

// ── Mutations ───────────────────────────────────────────────────────────────

export const createAnonymousUser = mutation({
  args: {},
  returns: v.object({ user: sessionUserValidator, sessionToken: v.string() }),
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
    if (!user) throw new ConvexError('Unable to create a reporting session');
    // A newly created token is returned only to the creator, separately from
    // profile data. Queries never echo stored bearer credentials.
    return { user: sessionUser(user), sessionToken };
  },
});

export const upgradeToAuthenticated = mutation({
  args: {
    sessionToken: v.string(),
    email: v.string(),
    authProvider: v.string(),
    authId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureUser(ctx, args.sessionToken);
    // This endpoint previously trusted caller-supplied provider claims and
    // could transfer ownership and rotate another account's session token.
    // Keep it closed until a configured provider supplies a verified identity
    // via ctx.auth. Even legacy stored email/provider fields are unverified.
    throw new ConvexError(VERIFIED_SIGN_IN_UNAVAILABLE);
  },
});

export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureUser(ctx, args.sessionToken);
    // This authenticated-only feature must not trust self-asserted legacy email.
    throw new ConvexError(VERIFIED_SIGN_IN_UNAVAILABLE);
  },
});

// ── Queries ─────────────────────────────────────────────────────────────────

export const getBySession = query({
  args: { sessionToken: v.string() },
  returns: v.union(v.null(), sessionUserValidator),
  handler: (ctx, args) => findSessionUser(ctx, args.sessionToken),
});

export const getById = query({
  args: { userId: v.id('users') },
  returns: v.union(v.null(), publicProfileValidator),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user ? publicProfile(user) : null;
  },
});

export const getCurrentUser = query({
  args: { sessionToken: v.string() },
  returns: v.union(v.null(), sessionUserValidator),
  handler: (ctx, args) => findSessionUser(ctx, args.sessionToken),
});
