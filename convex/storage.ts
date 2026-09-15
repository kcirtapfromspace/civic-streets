import { ConvexError, v } from 'convex/values';
import { action, internalMutation, mutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ensureUser } from './users';
import {
  MAX_PHOTO_BYTES, MAX_PHOTO_DIMENSION, MAX_PHOTO_PIXELS,
  MAX_REPORT_PHOTOS, PHOTO_CONTENT_TYPE, PHOTO_UPLOAD_TTL_MS, UPLOAD_LIMITS,
} from '../shared/photo-upload';

// A cleanup marker, NOT an ownership credential. Ownership is established by
// the server-only reserve/finalize protocol, never by client-supplied metadata.
export const MANAGED_PHOTO_CONTENT_TYPE = 'image/jpeg; curbwise-upload=v1';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CLEANUP_BATCH = 50;

/**
 * Check JPEG framing and dimensions beyond the declared MIME type. This is not
 * a full decoder or malware scan. Browser recompression is useful for UX, but
 * cannot be trusted as a server-side security guarantee.
 */
export function validatePhotoBytes(bytes: ArrayBuffer, contentType: string): void {
  if (contentType !== PHOTO_CONTENT_TYPE) {
    throw new ConvexError('Photos must be JPEG images. Please add the photo again.');
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new ConvexError('Each prepared photo must be no larger than 512 KiB.');
  }
  const data = new Uint8Array(bytes);
  const invalid = () => new ConvexError('The photo is not a supported JPEG image.');
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8 ||
      data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) {
    throw invalid();
  }
  let offset = 2;
  let sawFrame = false;
  while (offset < data.length - 2) {
    if (data[offset++] !== 0xff) throw invalid();
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (offset + 2 > data.length || marker === 0 || marker === 0xd8 || marker === 0xd9) {
      throw invalid();
    }
    const length = (data[offset] << 8) | data[offset + 1];
    if (length < 2 || offset + length > data.length - 2) throw invalid();
    // Baseline, extended sequential and progressive JPEG frames.
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (length < 8 || data[offset + 2] !== 8) throw invalid();
      const height = (data[offset + 3] << 8) | data[offset + 4];
      const width = (data[offset + 5] << 8) | data[offset + 6];
      const components = data[offset + 7];
      if ((components !== 1 && components !== 3) || length !== 8 + 3 * components) throw invalid();
      if (!height || !width || height > MAX_PHOTO_DIMENSION || width > MAX_PHOTO_DIMENSION ||
          height * width > MAX_PHOTO_PIXELS) {
        throw new ConvexError('Photo dimensions are too large. Please add a smaller photo.');
      }
      sawFrame = true;
    }
    if (marker === 0xda) {
      if (!sawFrame || length < 6 || offset + length >= data.length - 2) throw invalid();
      const components = data[offset + 2];
      if ((components !== 1 && components !== 3) || length !== 6 + 2 * components) throw invalid();
      return;
    }
    offset += length;
  }
  throw invalid();
}

/** Old bundles fail closed instead of obtaining an unrestricted upload URL. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (): Promise<string> => {
    throw new ConvexError('Photo uploads have changed. Refresh the page and try again.');
  },
});

async function reserveQuota(
  ctx: MutationCtx,
  key: string,
  size: number,
  maxCount: number,
  maxBytes: number,
  expiresAt?: number,
): Promise<void> {
  const existing = await ctx.db.query('uploadQuotas')
    .withIndex('by_key', (q) => q.eq('key', key)).unique();
  const count = (existing?.count ?? 0) + 1;
  const bytes = (existing?.bytes ?? 0) + size;
  if (count > maxCount || bytes > maxBytes) {
    throw new ConvexError('Photo upload limit reached. Please try again later.');
  }
  if (existing) await ctx.db.patch(existing._id, { count, bytes });
  else await ctx.db.insert('uploadQuotas', { key, count, bytes, expiresAt });
}

export const reserveUpload = internalMutation({
  args: { sessionToken: v.string(), size: v.number(), sha256: v.string() },
  handler: async (ctx, args): Promise<Id<'photoUploads'>> => {
    const user = await ensureUser(ctx, args.sessionToken);
    if (!Number.isInteger(args.size) || args.size <= 0 || args.size > MAX_PHOTO_BYTES) {
      throw new ConvexError('Invalid photo size.');
    }
    const now = Date.now();
    const hour = Math.floor(now / HOUR_MS);
    const day = Math.floor(now / DAY_MS);
    // Counters and reservation commit atomically. Fresh sessions cannot reset
    // global limits. Failed attempts deliberately consume their allowance.
    await reserveQuota(ctx, `user:${user._id}:hour:${hour}`, args.size,
      UPLOAD_LIMITS.userPerHour, UPLOAD_LIMITS.userPerHour * MAX_PHOTO_BYTES, (hour + 2) * HOUR_MS);
    await reserveQuota(ctx, `user:${user._id}:day:${day}`, args.size,
      UPLOAD_LIMITS.userPerDay, UPLOAD_LIMITS.userPerDay * MAX_PHOTO_BYTES, (day + 2) * DAY_MS);
    await reserveQuota(ctx, `global:hour:${hour}`, args.size,
      UPLOAD_LIMITS.globalPerHour, UPLOAD_LIMITS.globalPerHour * MAX_PHOTO_BYTES, (hour + 2) * HOUR_MS);
    await reserveQuota(ctx, `global:day:${day}`, args.size,
      UPLOAD_LIMITS.globalPerDay, UPLOAD_LIMITS.globalBytesPerDay, (day + 2) * DAY_MS);
    await reserveQuota(ctx, 'global:lifetime', args.size,
      Number.MAX_SAFE_INTEGER, UPLOAD_LIMITS.globalLifetimeBytes);
    return await ctx.db.insert('photoUploads', {
      userId: user._id, size: args.size, sha256: args.sha256,
      createdAt: now, expiresAt: now + PHOTO_UPLOAD_TTL_MS,
    });
  },
});

export const finalizeUpload = internalMutation({
  args: { uploadId: v.id('photoUploads'), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload || upload.storageId || upload.hotspotId || !upload.expiresAt || upload.expiresAt <= Date.now()) {
      throw new ConvexError('The photo upload expired. Please add the photo again.');
    }
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata || metadata.size !== upload.size || metadata.sha256 !== upload.sha256 ||
        metadata.contentType !== MANAGED_PHOTO_CONTENT_TYPE) {
      throw new ConvexError('Photo upload validation failed.');
    }
    const existing = await ctx.db.query('photoUploads')
      .withIndex('by_storageId', (q) => q.eq('storageId', args.storageId)).unique();
    if (existing) throw new ConvexError('Photo already belongs to an upload.');
    await ctx.db.patch(upload._id, { storageId: args.storageId });
  },
});

/** The server checks, stores and assigns ownership of the same received bytes. */
export const uploadPhoto = action({
  args: { sessionToken: v.string(), bytes: v.bytes(), contentType: v.string() },
  handler: async (ctx, args): Promise<Id<'_storage'>> => {
    validatePhotoBytes(args.bytes, args.contentType);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', args.bytes));
    const sha256 = btoa(String.fromCharCode(...digest));
    const uploadId: Id<'photoUploads'> = await ctx.runMutation(internal.storage.reserveUpload, {
      sessionToken: args.sessionToken, size: args.bytes.byteLength, sha256,
    });
    const storageId = await ctx.storage.store(new Blob([args.bytes], { type: MANAGED_PHOTO_CONTENT_TYPE }));
    try {
      await ctx.runMutation(internal.storage.finalizeUpload, { uploadId, storageId });
      return storageId;
    } catch (error) {
      // Interruption before finalization is covered by the marked-file sweep.
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});

/** Call after inserting the hotspot, in the SAME transaction. */
export async function claimPhotoUploads(
  ctx: MutationCtx,
  userId: Id<'users'>,
  storageIds: Id<'_storage'>[],
  hotspotId: Id<'hotspots'>,
): Promise<void> {
  if (storageIds.length > MAX_REPORT_PHOTOS || new Set(storageIds).size !== storageIds.length) {
    throw new ConvexError('A report can include up to three different photos.');
  }
  for (const storageId of storageIds) {
    const upload = await ctx.db.query('photoUploads')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId)).unique();
    if (!upload || upload.userId !== userId || upload.hotspotId ||
        !upload.expiresAt || upload.expiresAt <= Date.now()) {
      throw new ConvexError('A photo does not belong to this reporting session or has expired. Please add it again.');
    }
    const metadata = await ctx.db.system.get(storageId);
    if (!metadata || metadata.size !== upload.size || metadata.size > MAX_PHOTO_BYTES ||
        metadata.sha256 !== upload.sha256 || metadata.contentType !== MANAGED_PHOTO_CONTENT_TYPE) {
      throw new ConvexError('A photo could not be verified. Please add it again.');
    }
    await ctx.db.patch(upload._id, { hotspotId, expiresAt: undefined });
  }
}

/** Bounded indexed cleanup; transactions serialize safely with report claims. */
export const cleanupUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db.query('photoUploads')
      .withIndex('by_expiresAt', (q) => q.gt('expiresAt', 0).lte('expiresAt', now)).take(CLEANUP_BATCH);
    for (const upload of expired) {
      if (upload.hotspotId) continue;
      if (upload.storageId) await ctx.storage.delete(upload.storageId);
      await ctx.db.delete(upload._id);
    }
    const oldQuotas = await ctx.db.query('uploadQuotas')
      .withIndex('by_expiresAt', (q) => q.gt('expiresAt', 0).lte('expiresAt', now)).take(CLEANUP_BATCH);
    for (const quota of oldQuotas) await ctx.db.delete(quota._id);

    // Actions cannot atomically store a blob and write a DB row. Sweep a bounded
    // page to recover this gap, ignoring all legacy/unmarked files. A 24-hour
    // grace period exceeds Convex's maximum action execution time.
    const state = await ctx.db.query('uploadCleanupState')
      .withIndex('by_key', (q) => q.eq('key', 'managed-photos')).unique();
    const page = await ctx.db.system.query('_storage').paginate({
      cursor: state?.cursor ?? null, numItems: CLEANUP_BATCH,
    });
    let interrupted = 0;
    for (const metadata of page.page) {
      if (metadata.contentType !== MANAGED_PHOTO_CONTENT_TYPE ||
          metadata._creationTime > now - PHOTO_UPLOAD_TTL_MS) continue;
      const owned = await ctx.db.query('photoUploads')
        .withIndex('by_storageId', (q) => q.eq('storageId', metadata._id)).unique();
      if (!owned) {
        await ctx.storage.delete(metadata._id);
        interrupted++;
      }
    }
    const cursor = page.isDone ? null : page.continueCursor;
    if (state) await ctx.db.patch(state._id, { cursor });
    else await ctx.db.insert('uploadCleanupState', { key: 'managed-photos', cursor });
    return { expired: expired.length, interrupted, quotas: oldQuotas.length };
  },
});

/** Resolve legacy and new report images; not exposed as a public query. */
export async function resolveStorageUrls(
  ctx: { storage: { getUrl: (id: Id<'_storage'>) => Promise<string | null> } },
  storageIds: Id<'_storage'>[],
): Promise<string[]> {
  const results = await Promise.all(storageIds.map((id) => ctx.storage.getUrl(id)));
  return results.filter((url): url is string => url !== null);
}
