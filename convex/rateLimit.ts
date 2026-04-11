import { MutationCtx } from './_generated/server';
import { internalMutation } from './_generated/server';
import { Id } from './_generated/dataModel';

// ── Tier definitions ────────────────────────────────────────────────────
// Rate limits scale with user reputation to reward good actors.
interface RateTier {
  maxPerHour: number;
  maxPerDay: number;
  cooldownMs: number;
}

function getTier(reputation: number): RateTier {
  if (reputation >= 50) {
    // ESTABLISHED
    return { maxPerHour: 10, maxPerDay: 40, cooldownMs: 15_000 };
  }
  if (reputation >= 10) {
    // BASIC
    return { maxPerHour: 5, maxPerDay: 20, cooldownMs: 30_000 };
  }
  // NEW (reputation < 10)
  return { maxPerHour: 3, maxPerDay: 10, cooldownMs: 60_000 };
}

// ── checkRateLimit ──────────────────────────────────────────────────────
// Validates a user is within their tier's submission limits.
// Throws a user-facing error string if any limit is exceeded.
// On success, records the action so future calls see it.
export async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string,
  reputation: number,
): Promise<void> {
  const tier = getTier(reputation);
  const now = Date.now();

  // Fetch all entries for this user + action (index is userId, action, timestamp).
  const entries = await ctx.db
    .query('rateLimits')
    .withIndex('by_user_action', (q) =>
      q.eq('userId', userId).eq('action', action),
    )
    .collect();

  // ── Cooldown check ────────────────────────────────────────────────────
  if (entries.length > 0) {
    const mostRecent = entries[entries.length - 1];
    if (now - mostRecent.timestamp < tier.cooldownMs) {
      throw new Error('Please wait before submitting another report');
    }
  }

  // ── Hourly limit ──────────────────────────────────────────────────────
  const oneHourAgo = now - 60 * 60 * 1000;
  const hourlyCount = entries.filter((e) => e.timestamp > oneHourAgo).length;
  if (hourlyCount >= tier.maxPerHour) {
    throw new Error('Hourly report limit reached. Try again later.');
  }

  // ── Daily limit ───────────────────────────────────────────────────────
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const dailyCount = entries.filter((e) => e.timestamp > oneDayAgo).length;
  if (dailyCount >= tier.maxPerDay) {
    throw new Error('Daily report limit reached. Try again tomorrow.');
  }

  // All checks passed — record this action
  await ctx.db.insert('rateLimits', { userId, action, timestamp: now });
}

// ── recordRateLimit ─────────────────────────────────────────────────────
// Standalone insert for use after a successful mutation (e.g. hotspot
// creation) when you want to defer the record to after validation.
export async function recordRateLimit(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string,
): Promise<void> {
  await ctx.db.insert('rateLimits', {
    userId,
    action,
    timestamp: Date.now(),
  });
}

// ── Cleanup internal mutation ───────────────────────────────────────────
// Purges rate-limit records older than 48 hours. Called by cron.
export const purgeOldRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;

    // With 6-hour cleanup cadence the table stays small, so a full
    // collect + filter is fine.
    const allEntries = await ctx.db.query('rateLimits').collect();

    let deleted = 0;
    for (const entry of allEntries) {
      if (entry.timestamp < cutoff) {
        await ctx.db.delete(entry._id);
        deleted++;
      }
    }

    return { deleted };
  },
});
