// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);

async function setup() {
  const t = convexTest(schema, modules);
  const owner = await t.mutation(api.users.createAnonymousUser, {});
  const attacker = await t.mutation(api.users.createAnonymousUser, {});
  await t.run((ctx) =>
    ctx.db.patch(owner.user._id, {
      email: 'owner@example.test',
      authProvider: 'legacy-provider',
      authId: 'claimed-owner-id',
    }),
  );
  return { t, owner, attacker };
}

describe('account security', () => {
  it('returns the new bearer token separately without embedding credentials in the profile', async () => {
    const { owner } = await setup();
    expect(owner.sessionToken).toEqual(expect.any(String));
    expect(owner.user).not.toHaveProperty('sessionToken');
    expect(owner.user).not.toHaveProperty('authProvider');
    expect(owner.user).not.toHaveProperty('authId');
    expect(owner.user.isAuthenticated).toBe(false);
  });

  it.each([
    ['legacy-provider', 'claimed-owner-id', 'owner@example.test'],
    ['legacy-provider', 'new-claimed-id', 'owner@example.test'],
    ['invented-provider', 'attacker-id', 'attacker@example.test'],
  ])(
    'rejects unverified upgrade claims (%s, %s) without changing accounts',
    async (authProvider, authId, email) => {
      const { t, owner, attacker } = await setup();
      const before = await t.run(async (ctx) => ({
        owner: await ctx.db.get(owner.user._id),
        attacker: await ctx.db.get(attacker.user._id),
      }));
      await expect(
        t.mutation(api.users.upgradeToAuthenticated, {
          sessionToken: attacker.sessionToken,
          authProvider,
          authId,
          email,
        }),
      ).rejects.toThrow('Verified account sign-in is not available');
      expect(
        await t.run(async (ctx) => ({
          owner: await ctx.db.get(owner.user._id),
          attacker: await ctx.db.get(attacker.user._id),
        })),
      ).toEqual(before);
      expect(
        await t.query(api.users.getCurrentUser, { sessionToken: owner.sessionToken }),
      ).toMatchObject({ _id: owner.user._id, isAuthenticated: false });
    },
  );

  it('also fails closed with an identity until provider linking is configured', async () => {
    const { t, attacker } = await setup();
    const client = t.withIdentity({
      issuer: 'https://unconfigured.example.test',
      subject: 'attacker',
    });
    await expect(
      client.mutation(api.users.upgradeToAuthenticated, {
        sessionToken: attacker.sessionToken,
        authProvider: 'legacy-provider',
        authId: 'claimed-owner-id',
        email: 'owner@example.test',
      }),
    ).rejects.toThrow('Verified account sign-in is not available');
  });

  it('never returns private auth fields from user queries or treats legacy email as verified', async () => {
    const { t, owner } = await setup();
    const publicUser = await t.query(api.users.getById, { userId: owner.user._id });
    expect(Object.keys(publicUser!).sort()).toEqual([
      '_id',
      'createdAt',
      'displayName',
      'reputation',
    ]);
    for (const endpoint of [api.users.getBySession, api.users.getCurrentUser]) {
      const current = await t.query(endpoint, { sessionToken: owner.sessionToken });
      expect(current).toMatchObject({ email: 'owner@example.test', isAuthenticated: false });
      expect(current).not.toHaveProperty('sessionToken');
      expect(current).not.toHaveProperty('authProvider');
      expect(current).not.toHaveProperty('authId');
      expect(await t.query(endpoint, { sessionToken: 'unknown-session' })).toBeNull();
      expect(await t.query(endpoint, { sessionToken: '' })).toBeNull();
    }
  });

  it('does not permit authenticated-only profile edits through legacy email', async () => {
    const { t, owner } = await setup();
    await expect(
      t.mutation(api.users.updateProfile, {
        sessionToken: owner.sessionToken,
        displayName: 'Spoofed official',
      }),
    ).rejects.toThrow('Verified account sign-in is not available');
    expect(await t.query(api.users.getById, { userId: owner.user._id })).toMatchObject({
      displayName: owner.user.displayName,
    });
  });

  it.each(['', 'unknown-session'])(
    'rejects invalid mutation sessions (%s) before account changes',
    async (sessionToken) => {
      const { t, owner } = await setup();
      await expect(
        t.mutation(api.users.updateProfile, { sessionToken, displayName: 'Unauthorized' }),
      ).rejects.toThrow('Invalid session');
      await expect(
        t.mutation(api.users.upgradeToAuthenticated, {
          sessionToken,
          email: 'owner@example.test',
          authProvider: 'legacy-provider',
          authId: 'claimed-owner-id',
        }),
      ).rejects.toThrow('Invalid session');
      expect(await t.query(api.users.getById, { userId: owner.user._id })).toMatchObject({
        displayName: owner.user.displayName,
      });
    },
  );

  it('does not retain access through a deleted account or expose its public profile', async () => {
    const { t, owner } = await setup();
    await t.run((ctx) => ctx.db.delete(owner.user._id));
    expect(await t.query(api.users.getById, { userId: owner.user._id })).toBeNull();
    expect(
      await t.query(api.users.getCurrentUser, { sessionToken: owner.sessionToken }),
    ).toBeNull();
    await expect(
      t.mutation(api.users.updateProfile, { sessionToken: owner.sessionToken }),
    ).rejects.toThrow('Invalid session');
  });

  it('issues distinct session capabilities and permits public avatar data without exposing authentication fields', async () => {
    const { t, owner, attacker } = await setup();
    expect(owner.user._id).not.toBe(attacker.user._id);
    expect(owner.sessionToken).not.toBe(attacker.sessionToken);
    await t.run((ctx) =>
      ctx.db.patch(owner.user._id, { avatarUrl: 'https://example.test/avatar.jpg' }),
    );
    const profile = await t.query(api.users.getById, { userId: owner.user._id });
    expect(profile).toMatchObject({ avatarUrl: 'https://example.test/avatar.jpg' });
    for (const key of ['sessionToken', 'email', 'authProvider', 'authId'])
      expect(profile).not.toHaveProperty(key);
  });
});
