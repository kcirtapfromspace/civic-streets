// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import { checkRateLimit, recordRateLimit } from './rateLimit';
import schema from './schema';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
async function setup() {
  const t = convexTest(schema, modules);
  const { user } = await t.mutation(api.users.createAnonymousUser, {});
  return { t, userId: user._id };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('reporting rate limits', () => {
  it.each([
    [9, 60_000],
    [10, 30_000],
    [49, 30_000],
    [50, 15_000],
  ])(
    'allows reputation %s reporters at the cooldown boundary (%sms), not before',
    async (reputation, cooldown) => {
      const { t, userId } = await setup();
      await t.run((ctx) => checkRateLimit(ctx, userId, 'hotspot_create', reputation));
      vi.setSystemTime(Date.now() + cooldown - 1);
      await expect(
        t.run((ctx) => checkRateLimit(ctx, userId, 'hotspot_create', reputation)),
      ).rejects.toThrow('Please wait');
      expect(await t.run((ctx) => ctx.db.query('rateLimits').take(10))).toHaveLength(1);
      vi.setSystemTime(Date.now() + 1);
      await t.run((ctx) => checkRateLimit(ctx, userId, 'hotspot_create', reputation));
      expect(await t.run((ctx) => ctx.db.query('rateLimits').take(10))).toHaveLength(2);
    },
  );

  it.each([
    [0, 3, 60_000],
    [10, 5, 30_000],
    [50, 10, 15_000],
  ])('enforces the %s-reputation hourly allowance', async (reputation, allowance, cooldown) => {
    const { t, userId } = await setup();
    await t.run(async (ctx) => {
      for (let i = 1; i < allowance; i++)
        await ctx.db.insert('rateLimits', {
          userId,
          action: 'hotspot_create',
          timestamp: Date.now() - i * 120_000,
        });
    });
    await t.run((ctx) => checkRateLimit(ctx, userId, 'hotspot_create', reputation));
    vi.setSystemTime(Date.now() + cooldown);
    await expect(
      t.run((ctx) => checkRateLimit(ctx, userId, 'hotspot_create', reputation)),
    ).rejects.toThrow('Hourly report limit');
    expect(await t.run((ctx) => ctx.db.query('rateLimits').take(50))).toHaveLength(allowance);
  });

  it.each([
    [0, 10],
    [10, 20],
    [50, 40],
  ])(
    'enforces the %s-reputation daily allowance outside the hourly window',
    async (reputation, allowance) => {
      const { t, userId } = await setup();
      await t.run(async (ctx) => {
        for (let i = 0; i < allowance; i++)
          await ctx.db.insert('rateLimits', {
            userId,
            action: 'hotspot_create',
            timestamp: Date.now() - 2 * HOUR - i * 60_000,
          });
      });
      await expect(
        t.run((ctx) => checkRateLimit(ctx, userId, 'hotspot_create', reputation)),
      ).rejects.toThrow('Daily report limit');
      expect(await t.run((ctx) => ctx.db.query('rateLimits').take(50))).toHaveLength(allowance);
    },
  );

  it('isolates rate limits by user and action, and ignores records exactly outside their windows', async () => {
    const { t, userId } = await setup();
    const other = await t.mutation(api.users.createAnonymousUser, {});
    await t.run(async (ctx) => {
      await recordRateLimit(ctx, other.user._id, 'hotspot_create');
      await recordRateLimit(ctx, userId, 'another-action');
      // Two records count in the last hour. The exact hour boundary does not.
      for (const age of [120_000, 240_000, HOUR, DAY])
        await ctx.db.insert('rateLimits', {
          userId,
          action: 'hotspot_create',
          timestamp: Date.now() - age,
        });
    });
    await t.run((ctx) => checkRateLimit(ctx, userId, 'hotspot_create', 0));
    const rows = await t.run((ctx) => ctx.db.query('rateLimits').take(20));
    expect(
      rows.filter(
        (row) =>
          row.userId === userId && row.action === 'hotspot_create' && row.timestamp === Date.now(),
      ),
    ).toHaveLength(1);
    expect(rows.filter((row) => row.userId === other.user._id)).toHaveLength(1);
  });

  it('drops records older than the daily window before deciding whether a new report is allowed', async () => {
    const { t, userId } = await setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < 10; i++)
        await ctx.db.insert('rateLimits', {
          userId,
          action: 'hotspot_create',
          timestamp: Date.now() - DAY - i,
        });
    });
    await t.run((ctx) => checkRateLimit(ctx, userId, 'hotspot_create', 0));
  });

  it('purges only expired retention records and is safe to run again', async () => {
    const { t, userId } = await setup();
    const [oldId, boundaryId, recentId] = await t.run(async (ctx) =>
      Promise.all(
        [2 * DAY + 1, 2 * DAY, 60_000].map((age) =>
          ctx.db.insert('rateLimits', {
            userId,
            action: 'hotspot_create',
            timestamp: Date.now() - age,
          }),
        ),
      ),
    );
    await expect(t.mutation(internal.rateLimit.purgeOldRateLimits, {})).resolves.toEqual({
      deleted: 1,
    });
    expect(await t.run((ctx) => ctx.db.get(oldId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(boundaryId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(recentId))).not.toBeNull();
    await expect(t.mutation(internal.rateLimit.purgeOldRateLimits, {})).resolves.toEqual({
      deleted: 0,
    });
  });
});
