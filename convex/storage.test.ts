// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { claimPhotoUploads, MANAGED_PHOTO_CONTENT_TYPE } from './storage';
import {
  MAX_PHOTO_BYTES,
  MAX_REPORT_PHOTOS,
  PHOTO_UPLOAD_TTL_MS,
  UPLOAD_LIMITS,
} from '../shared/photo-upload';
import { jpegBytes } from '../test-fixtures/photo';
import { installStorageMetadataShim } from '../test-fixtures/convex-storage';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;

async function setup(moduleOverrides: Record<string, () => Promise<unknown>> = {}) {
  const t = convexTest(schema, { ...modules, ...moduleOverrides });
  installStorageMetadataShim();
  const { user, sessionToken } = await t.mutation(api.users.createAnonymousUser, {});
  const upload = () =>
    t.action(api.storage.uploadPhoto, {
      sessionToken,
      bytes: jpegBytes(),
      contentType: 'image/jpeg',
    });
  const claim = (userId: Id<'users'>, ids: Id<'_storage'>[]) =>
    t.run(async (ctx) => {
      const hotspotId = await ctx.db.insert('hotspots', {
        userId,
        title: 'Test street issue',
        description: 'A damaged curb ramp',
        category: 'accessibility',
        severity: 'high',
        lat: 39.74,
        lng: -104.99,
        address: 'Denver, CO',
        upvotes: 0,
        commentCount: 0,
        status: 'open',
        photoStorageIds: ids,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await claimPhotoUploads(ctx, userId, ids, hotspotId);
      return hotspotId;
    });
  return { t, user: user!, sessionToken, upload, claim };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function photoDigest(bytes = jpegBytes()) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return btoa(String.fromCharCode(...digest));
}

function paddedJpeg(size: number): ArrayBuffer {
  const original = new Uint8Array(jpegBytes());
  const result = new Uint8Array(size);
  result.set(original.subarray(0, 2));
  let offset = 2;
  let remaining = size - original.length;
  // JPEG APP15 segments are ignored by decoders; keep the actual image intact.
  while (remaining > 0) {
    const segmentSize = Math.min(remaining, 65_537);
    const length = segmentSize - 2;
    result.set([0xff, 0xef, length >> 8, length & 0xff], offset);
    offset += segmentSize;
    remaining -= segmentSize;
  }
  result.set(original.subarray(2), offset);
  return result.buffer;
}

describe('server-owned photo uploads', () => {
  it('disables the unrestricted legacy upload URL', async () => {
    const { t } = await setup();
    await expect(t.mutation(api.storage.generateUploadUrl, {})).rejects.toThrow('Refresh the page');
  });

  it('requires a valid reporting session before reserving or storing', async () => {
    const { t } = await setup();
    await expect(
      t.action(api.storage.uploadPhoto, {
        sessionToken: 'invalid-session',
        bytes: jpegBytes(),
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow('Invalid session');
    expect(await t.run((ctx) => ctx.db.query('photoUploads').take(1))).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.system.query('_storage').take(1))).toHaveLength(0);
  });

  it.each([
    ['HTML MIME type', () => jpegBytes(), 'text/html'],
    ['SVG MIME type', () => jpegBytes(), 'image/svg+xml'],
    [
      'spoofed JPEG MIME type',
      () => new TextEncoder().encode('<script>alert(1)</script>').buffer,
      'image/jpeg',
    ],
    ['empty upload', () => new ArrayBuffer(0), 'image/jpeg'],
    ['oversized upload', () => new ArrayBuffer(MAX_PHOTO_BYTES + 1), 'image/jpeg'],
    ['truncated JPEG', () => jpegBytes().slice(0, -2), 'image/jpeg'],
    [
      'JPEG magic prefix alone',
      () => new Uint8Array([255, 216, 1, 2, 3, 255, 217]).buffer,
      'image/jpeg',
    ],
  ])('rejects %s without consuming storage or upload quota', async (_label, bytes, contentType) => {
    const { t, sessionToken } = await setup();
    await expect(
      t.action(api.storage.uploadPhoto, { sessionToken, bytes: bytes(), contentType }),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query('photoUploads').take(1))).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query('uploadQuotas').take(1))).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.system.query('_storage').take(1))).toHaveLength(0);
  });

  it('rejects JPEG headers declaring excessive dimensions', async () => {
    const { t, sessionToken } = await setup();
    const bytes = new Uint8Array(jpegBytes());
    const frame = bytes.findIndex((value, index) => value === 255 && bytes[index + 1] === 192);
    expect(frame).toBeGreaterThan(0);
    bytes[frame + 7] = 0x20;
    bytes[frame + 8] = 0;
    await expect(
      t.action(api.storage.uploadPhoto, {
        sessionToken,
        bytes: bytes.buffer,
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow('dimensions are too large');
  });

  it('binds stored JPEG bytes to the session and permits one atomic report claim', async () => {
    const { t, user, upload, claim } = await setup();
    const id = await upload();
    const before = await t.run((ctx) =>
      ctx.db
        .query('photoUploads')
        .withIndex('by_storageId', (q) => q.eq('storageId', id))
        .unique(),
    );
    expect(before).toMatchObject({ userId: user._id, size: jpegBytes().byteLength });
    expect(before?.expiresAt).toBeGreaterThan(Date.now());
    const hotspotId = await claim(user._id, [id]);
    const after = await t.run((ctx) => ctx.db.get(before!._id));
    expect(after).toMatchObject({ hotspotId });
    expect(after?.expiresAt).toBeUndefined();
    await expect(claim(user._id, [id])).rejects.toThrow('does not belong');
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(5))).toHaveLength(1);
  });

  it('rejects claiming another session upload even when its storage ID is known', async () => {
    const { t, upload, claim } = await setup();
    const id = await upload();
    const other = await t.mutation(api.users.createAnonymousUser, {});
    await expect(claim(other.user!._id, [id])).rejects.toThrow('does not belong');
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(1))).toHaveLength(0);
  });

  it('rejects arbitrary existing storage IDs and duplicate or excessive photo lists', async () => {
    const { t, user, upload, claim } = await setup();
    const legacyId = await t.run((ctx) =>
      ctx.storage.store(new Blob([jpegBytes()], { type: 'image/jpeg' })),
    );
    await expect(claim(user._id, [legacyId])).rejects.toThrow('does not belong');
    const id = await upload();
    await expect(claim(user._id, [id, id])).rejects.toThrow('three different photos');
    const ids = [id, await upload(), await upload(), await upload()];
    await expect(claim(user._id, ids)).rejects.toThrow('three different photos');
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(1))).toHaveLength(0);
  });

  it('rejects missing storage bytes even if an ownership row exists', async () => {
    const { t, user, upload, claim } = await setup();
    const id = await upload();
    await t.run((ctx) => ctx.storage.delete(id));
    await expect(claim(user._id, [id])).rejects.toThrow('could not be verified');
  });

  it('enforces the per-session allowance without reserving further blobs', async () => {
    const { t, user, upload } = await setup();
    const hour = Math.floor(Date.now() / hourMs);
    await t.run((ctx) =>
      ctx.db.insert('uploadQuotas', {
        key: `user:${user._id}:hour:${hour}`,
        count: UPLOAD_LIMITS.userPerHour,
        bytes: 0,
        expiresAt: (hour + 2) * hourMs,
      }),
    );
    await expect(upload()).rejects.toThrow('upload limit');
    expect(await t.run((ctx) => ctx.db.query('photoUploads').take(1))).toHaveLength(0);
  });

  it.each(['daily count', 'daily bytes', 'lifetime bytes'])(
    'enforces global %s limits across fresh anonymous sessions',
    async (limit) => {
      const { t } = await setup();
      const day = Math.floor(Date.now() / dayMs);
      await t.run((ctx) =>
        ctx.db.insert('uploadQuotas', {
          key: limit === 'lifetime bytes' ? 'global:lifetime' : `global:day:${day}`,
          count: limit === 'daily count' ? UPLOAD_LIMITS.globalPerDay : 0,
          bytes:
            limit === 'daily bytes'
              ? UPLOAD_LIMITS.globalBytesPerDay
              : limit === 'lifetime bytes'
                ? UPLOAD_LIMITS.globalLifetimeBytes
                : 0,
        }),
      );
      const fresh = await t.mutation(api.users.createAnonymousUser, {});
      await expect(
        t.action(api.storage.uploadPhoto, {
          sessionToken: fresh.sessionToken,
          bytes: jpegBytes(),
          contentType: 'image/jpeg',
        }),
      ).rejects.toThrow('upload limit');
      expect(await t.run((ctx) => ctx.db.query('photoUploads').take(1))).toHaveLength(0);
      expect(await t.run((ctx) => ctx.db.system.query('_storage').take(1))).toHaveLength(0);
    },
  );

  it('expires abandoned uploads and interrupted stores while preserving claimed and legacy images', async () => {
    vi.useFakeTimers();
    const { t, user, upload, claim } = await setup();
    const claimedId = await upload();
    await claim(user._id, [claimedId]);
    const abandonedId = await upload();
    const interruptedId = await t.run((ctx) =>
      ctx.storage.store(new Blob([jpegBytes()], { type: MANAGED_PHOTO_CONTENT_TYPE })),
    );
    const legacyId = await t.run((ctx) =>
      ctx.storage.store(new Blob([jpegBytes()], { type: 'image/jpeg' })),
    );
    vi.setSystemTime(Date.now() + PHOTO_UPLOAD_TTL_MS + 1);
    await expect(claim(user._id, [abandonedId])).rejects.toThrow('has expired');
    await t.mutation(internal.storage.cleanupUploads, {});
    expect(await t.run((ctx) => ctx.db.system.get(abandonedId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(interruptedId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(claimedId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(legacyId))).not.toBeNull();
    const lifetime = await t.run((ctx) =>
      ctx.db
        .query('uploadQuotas')
        .withIndex('by_key', (q) => q.eq('key', 'global:lifetime'))
        .unique(),
    );
    expect(lifetime?.bytes).toBe(jpegBytes().byteLength * 2);
  });

  it('limits expiration work per invocation and eventually finishes the remainder', async () => {
    const { t, user } = await setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < 60; i++)
        await ctx.db.insert('photoUploads', {
          userId: user._id,
          size: 1,
          sha256: 'unused',
          createdAt: 1,
          expiresAt: 2,
        });
    });
    expect(await t.mutation(internal.storage.cleanupUploads, {})).toMatchObject({ expired: 50 });
    expect(await t.mutation(internal.storage.cleanupUploads, {})).toMatchObject({ expired: 10 });
  });

  it('accepts the maximum JPEG byte size and the maximum distinct photos in a report', async () => {
    const { t, user, sessionToken, upload, claim } = await setup();
    const maxSizePhoto = await t.action(api.storage.uploadPhoto, {
      sessionToken,
      bytes: paddedJpeg(MAX_PHOTO_BYTES),
      contentType: 'image/jpeg',
    });
    const ids = [maxSizePhoto];
    while (ids.length < MAX_REPORT_PHOTOS) ids.push(await upload());
    const reportId = await claim(user._id, ids);
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({ photoStorageIds: ids });
    expect(await t.run((ctx) => ctx.db.system.get(maxSizePhoto))).toMatchObject({
      size: MAX_PHOTO_BYTES,
    });
  });

  it.each([
    ['hour', hourMs, UPLOAD_LIMITS.userPerHour],
    ['day', dayMs, UPLOAD_LIMITS.userPerDay],
  ])(
    'resets the user %s allowance at the window boundary without resetting cumulative usage',
    async (window, duration, limit) => {
      vi.useFakeTimers();
      vi.setSystemTime(1_000_000);
      const { t, user, upload } = await setup();
      const bucket = Math.floor(Date.now() / duration);
      await t.run(async (ctx) => {
        await ctx.db.insert('uploadQuotas', {
          key: `user:${user._id}:${window}:${bucket}`,
          count: limit,
          bytes: 0,
          expiresAt: (bucket + 2) * duration,
        });
        await ctx.db.insert('uploadQuotas', { key: 'global:lifetime', count: 1, bytes: 123 });
      });
      vi.setSystemTime((bucket + 1) * duration - 1);
      await expect(upload()).rejects.toThrow('upload limit');
      vi.setSystemTime((bucket + 1) * duration);
      await expect(upload()).resolves.toBeTruthy();
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('uploadQuotas')
            .withIndex('by_key', (q) => q.eq('key', 'global:lifetime'))
            .unique(),
        ),
      ).toMatchObject({ count: 2, bytes: 123 + jpegBytes().byteLength });
    },
  );

  it.each(['size', 'checksum', 'MIME type'])(
    'refuses to finalize an upload when stored %s differs from the reservation',
    async (mismatch) => {
      const { t, sessionToken } = await setup();
      const uploadId = await t.mutation(internal.storage.reserveUpload, {
        sessionToken,
        size: jpegBytes().byteLength,
        sha256: await photoDigest(),
      });
      const bytes = new Uint8Array(jpegBytes());
      if (mismatch === 'checksum') bytes[bytes.length - 3] ^= 1;
      const storedBytes = mismatch === 'size' ? bytes.subarray(0, bytes.length - 1) : bytes;
      const storageId = await t.run((ctx) =>
        ctx.storage.store(
          new Blob([storedBytes], {
            type: mismatch === 'MIME type' ? 'text/html' : MANAGED_PHOTO_CONTENT_TYPE,
          }),
        ),
      );
      await expect(
        t.mutation(internal.storage.finalizeUpload, { uploadId, storageId }),
      ).rejects.toThrow('validation failed');
      expect(await t.run((ctx) => ctx.db.get(uploadId))).not.toHaveProperty('storageId');
    },
  );

  it('refuses late finalization at the expiration boundary', async () => {
    vi.useFakeTimers();
    const { t, sessionToken } = await setup();
    const uploadId = await t.mutation(internal.storage.reserveUpload, {
      sessionToken,
      size: jpegBytes().byteLength,
      sha256: await photoDigest(),
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([jpegBytes()], { type: MANAGED_PHOTO_CONTENT_TYPE })),
    );
    const pending = await t.run((ctx) => ctx.db.get(uploadId));
    vi.setSystemTime(pending!.expiresAt!);
    await expect(
      t.mutation(internal.storage.finalizeUpload, { uploadId, storageId }),
    ).rejects.toThrow('expired');
    expect(await t.run((ctx) => ctx.db.get(uploadId))).not.toHaveProperty('storageId');
  });

  it('does not assign one stored file to a second upload reservation', async () => {
    const { t, sessionToken, upload } = await setup();
    const storageId = await upload();
    const uploadId = await t.mutation(internal.storage.reserveUpload, {
      sessionToken,
      size: jpegBytes().byteLength,
      sha256: await photoDigest(),
    });
    await expect(
      t.mutation(internal.storage.finalizeUpload, { uploadId, storageId }),
    ).rejects.toThrow('already belongs');
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('photoUploads')
          .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
          .take(2),
      ),
    ).toHaveLength(1);
  });

  it('deletes the blob when ownership finalization fails and retains the spent allowance', async () => {
    const { t, upload } = await setup({
      './storage.ts': async () => ({
        ...((await modules['./storage.ts']()) as object),
        // Inject a failed DB boundary, while executing the real public action,
        // reservation mutation and storage backend. Never leave that blob behind.
        finalizeUpload: internalMutation({
          args: { uploadId: v.id('photoUploads'), storageId: v.id('_storage') },
          handler: async () => {
            throw new Error('Ownership database temporarily unavailable');
          },
        }),
      }),
    });
    await expect(upload()).rejects.toThrow('Ownership database temporarily unavailable');
    expect(await t.run((ctx) => ctx.db.system.query('_storage').take(1))).toEqual([]);
    const pending = await t.run((ctx) => ctx.db.query('photoUploads').take(2));
    expect(pending).toHaveLength(1);
    expect(pending[0].storageId).toBeUndefined();
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('uploadQuotas')
          .withIndex('by_key', (q) => q.eq('key', 'global:lifetime'))
          .unique(),
      ),
    ).toMatchObject({ count: 1, bytes: jpegBytes().byteLength });
  });

  it('resumes interrupted-file cleanup past a page boundary without deleting legacy files', async () => {
    vi.useFakeTimers();
    const { t } = await setup();
    const legacyId = await t.run((ctx) =>
      ctx.storage.store(new Blob([jpegBytes()], { type: 'image/jpeg' })),
    );
    const ids = await t.run(async (ctx) => {
      const stored: Id<'_storage'>[] = [];
      for (let i = 0; i < 60; i++) {
        stored.push(
          await ctx.storage.store(new Blob([jpegBytes()], { type: MANAGED_PHOTO_CONTENT_TYPE })),
        );
      }
      return stored;
    });
    vi.setSystemTime(Date.now() + PHOTO_UPLOAD_TTL_MS + 1_000);
    const first = await t.mutation(internal.storage.cleanupUploads, {});
    expect(first.interrupted).toBe(49);
    const state = await t.run((ctx) => ctx.db.query('uploadCleanupState').first());
    expect(state?.cursor).toBeTruthy();
    const second = await t.mutation(internal.storage.cleanupUploads, {});
    expect(second.interrupted).toBe(11);
    expect(await t.run((ctx) => ctx.db.get(state!._id))).toMatchObject({ cursor: null });
    for (const id of ids) expect(await t.run((ctx) => ctx.db.system.get(id))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(legacyId))).not.toBeNull();
  });
});
