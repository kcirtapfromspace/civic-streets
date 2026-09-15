// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { jpegBytes } from '../test-fixtures/photo';
import { installStorageMetadataShim } from '../test-fixtures/convex-storage';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const report = {
  title: 'Sidewalk blocked at the crossing',
  description: 'A damaged sidewalk blocks the accessible route to the crossing.',
  category: 'poor-sidewalk',
  severity: 'high',
  lat: 39.7392,
  lng: -104.9903,
  address: 'Denver, CO',
  clientMeta: { formDurationMs: 10_000 },
};

async function setup() {
  const t = convexTest(schema, modules);
  installStorageMetadataShim();
  const { sessionToken, user } = await t.mutation(api.users.createAnonymousUser, {});
  const photoId = await t.action(api.storage.uploadPhoto, {
    sessionToken,
    bytes: jpegBytes(),
    contentType: 'image/jpeg',
  });
  return { t, sessionToken, user: user!, photoStorageIds: [photoId] };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('community reporting in Denver and Chicago', () => {
  it.each([
    ['downtown Denver', 39.7392, -104.9903],
    ['Denver airport', 39.8561, -104.6737],
    ['northeast Denver', 39.87, -104.7],
    ['downtown Chicago', 41.881, -87.629],
    ['existing Chicago west boundary', 41.8, -88],
    ['Denver south/west pilot boundary', 39.55, -105.15],
  ])('saves and retrieves a report in %s', async (_name, lat, lng) => {
    const { t, sessionToken, photoStorageIds } = await setup();
    const id = await t.mutation(api.hotspots.create, {
      ...report,
      sessionToken,
      photoStorageIds,
      lat,
      lng,
    });
    const saved = await t.query(api.hotspots.getById, { hotspotId: id });
    expect(saved).toMatchObject({
      _id: id,
      lat,
      lng,
      title: report.title,
      status: 'open',
      photoStorageIds,
    });
    expect(saved?.photoUrls).toHaveLength(1);
  });

  it('returns Denver reports within Denver bounds without Chicago reports', async () => {
    const { t, sessionToken, photoStorageIds } = await setup();
    const denverId = await t.mutation(api.hotspots.create, {
      ...report,
      sessionToken,
      photoStorageIds,
    });
    const chicagoUser = await t.mutation(api.users.createAnonymousUser, {});
    const chicagoPhotoId = await t.action(api.storage.uploadPhoto, {
      sessionToken: chicagoUser.sessionToken,
      bytes: jpegBytes(),
      contentType: 'image/jpeg',
    });
    await t.mutation(api.hotspots.create, {
      ...report,
      photoStorageIds: [chicagoPhotoId],
      sessionToken: chicagoUser.sessionToken,
      lat: 41.881,
      lng: -87.629,
      address: 'Chicago, IL',
    });
    const results = await t.query(api.hotspots.getByBounds, {
      minLat: 39.55,
      maxLat: 40,
      minLng: -105.15,
      maxLng: -104.55,
    });
    expect(results.map((item) => item._id)).toEqual([denverId]);
  });

  it.each([
    ['Los Angeles', 34.05, -118.24],
    ['New York', 40.71, -74.01],
    ['mixed city coordinates', 39.7392, -87.629],
    ['north of Denver pilot', 40.0001, -104.99],
    ['east of Denver pilot', 39.74, -104.5499],
    ['west of Denver pilot', 39.74, -105.1501],
    ['south of Denver pilot', 39.5499, -104.99],
  ])('rejects %s without saving a report', async (_name, lat, lng) => {
    const { t, sessionToken, photoStorageIds } = await setup();
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
        lat,
        lng,
      }),
    ).rejects.toThrow('Denver and Chicago metro areas');
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(1))).toEqual([]);
    // A rejected report must not consume a successful-submission allowance.
    expect(await t.run((ctx) => ctx.db.query('rateLimits').take(1))).toEqual([]);
  });

  it.each([
    [NaN, -104.99, 'Latitude'],
    [Infinity, -104.99, 'Latitude'],
    [-Infinity, -104.99, 'Latitude'],
    [91, -104.99, 'Latitude'],
    [39.74, NaN, 'Longitude'],
    [39.74, Infinity, 'Longitude'],
    [39.74, -Infinity, 'Longitude'],
    [39.74, 181, 'Longitude'],
  ])('rejects invalid coordinates (%s, %s)', async (lat, lng, label) => {
    const { t, sessionToken, photoStorageIds } = await setup();
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
        lat,
        lng,
      }),
    ).rejects.toThrow(label);
  });

  it('keeps the photo requirement and allows a corrected retry immediately', async () => {
    const { t, sessionToken, photoStorageIds } = await setup();
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
      }),
    ).rejects.toThrow('at least one photo');
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
      }),
    ).resolves.toBeTruthy();
  });

  it('accepts the form’s skip-details path with a title, category and photo', async () => {
    const { t, sessionToken, photoStorageIds } = await setup();
    const id = await t.mutation(api.hotspots.create, {
      ...report,
      sessionToken,
      photoStorageIds,
      description: '',
    });
    expect(await t.query(api.hotspots.getById, { hotspotId: id })).toMatchObject({
      title: report.title,
      description: '',
      status: 'open',
    });
  });

  it('requires a real reporting session', async () => {
    const { t, photoStorageIds } = await setup();
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken: 'invalid-session',
        photoStorageIds,
      }),
    ).rejects.toThrow('Invalid session');
  });

  it('rejects the honeypot without returning a fake successful report ID', async () => {
    const { t, sessionToken, photoStorageIds } = await setup();
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
        honeypot: 'bot content',
      }),
    ).rejects.toThrow('Unable to submit');
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(1))).toEqual([]);
  });

  it('preserves cooldown and nearby duplicate protection in Denver', async () => {
    vi.useFakeTimers();
    const { t, sessionToken, photoStorageIds } = await setup();
    await t.mutation(api.hotspots.create, { ...report, sessionToken, photoStorageIds });
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
      }),
    ).rejects.toThrow('Please wait');
    vi.setSystemTime(Date.now() + 61_000);
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
      }),
    ).rejects.toThrow('similar issue nearby');
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(2))).toHaveLength(1);
  });

  it.each([
    ['hourly', 3, 120_000, 60_000, 'Hourly report limit'],
    ['daily', 10, 7_200_000, 600_000, 'Daily report limit'],
  ])('preserves the %s reporting limit', async (_name, count, age, spacing, message) => {
    const { t, sessionToken, user, photoStorageIds } = await setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < count; i++) {
        await ctx.db.insert('rateLimits', {
          userId: user._id,
          action: 'hotspot_create',
          timestamp: Date.now() - age - i * spacing,
        });
      }
    });
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
      }),
    ).rejects.toThrow(message);
  });

  it('ignores expired rate records', async () => {
    const { t, sessionToken, user, photoStorageIds } = await setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < 15; i++) {
        await ctx.db.insert('rateLimits', {
          userId: user._id,
          action: 'hotspot_create',
          timestamp: Date.now() - 25 * 60 * 60 * 1000 - i,
        });
      }
    });
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
      }),
    ).resolves.toBeTruthy();
  });

  it('rejects a photo owned by another session without publishing or consuming it', async () => {
    const { t, photoStorageIds } = await setup();
    const other = await t.mutation(api.users.createAnonymousUser, {});
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken: other.sessionToken,
        photoStorageIds,
      }),
    ).rejects.toThrow('does not belong');
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(1))).toEqual([]);
    const upload = await t.run((ctx) => ctx.db.query('photoUploads').first());
    expect(upload?.hotspotId).toBeUndefined();
    expect(upload?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects arbitrary storage IDs and external photo URLs', async () => {
    const { t, sessionToken } = await setup();
    const unowned = await t.run((ctx) =>
      ctx.storage.store(new Blob([jpegBytes()], { type: 'image/jpeg' })),
    );
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds: [unowned],
      }),
    ).rejects.toThrow('does not belong');
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoUrls: ['https://example.com/unowned.jpg'],
      }),
    ).rejects.toThrow('upload photos through this report form');
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(1))).toEqual([]);
  });

  it('prevents replaying an already attached photo in another report', async () => {
    vi.useFakeTimers();
    const { t, sessionToken, photoStorageIds } = await setup();
    const firstId = await t.mutation(api.hotspots.create, {
      ...report,
      sessionToken,
      photoStorageIds,
    });
    vi.setSystemTime(Date.now() + 61_000);
    await expect(
      t.mutation(api.hotspots.create, {
        ...report,
        sessionToken,
        photoStorageIds,
        lat: report.lat + 0.01,
      }),
    ).rejects.toThrow('does not belong');
    const upload = await t.run((ctx) => ctx.db.query('photoUploads').first());
    expect(upload?.hotspotId).toBe(firstId);
    expect(upload?.expiresAt).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(2))).toHaveLength(1);
  });

  it('rejects duplicate or excessive photo references before saving', async () => {
    const { t, sessionToken, photoStorageIds } = await setup();
    for (const ids of [Array(2).fill(photoStorageIds[0]), Array(4).fill(photoStorageIds[0])]) {
      await expect(
        t.mutation(api.hotspots.create, {
          ...report,
          sessionToken,
          photoStorageIds: ids,
        }),
      ).rejects.toThrow('up to three different photos');
    }
    expect(await t.run((ctx) => ctx.db.query('hotspots').take(1))).toEqual([]);
  });

  it('does not persist hidden photo GPS or device fingerprints on new reports', async () => {
    const { t, sessionToken, photoStorageIds } = await setup();
    const id = await t.mutation(api.hotspots.create, {
      ...report,
      sessionToken,
      photoStorageIds,
      photoExifData: [{ lat: 40.5, lng: -105.5, timestamp: 'private-photo-time' }],
      locationVerification: { photoHasGps: true, status: 'verified' },
      clientMeta: {
        formDurationMs: 10000,
        userAgent: 'private-device',
        timezone: 'private-timezone',
      },
    });
    const saved = await t.run((ctx) => ctx.db.get(id));
    expect(saved?.photoExifData).toBeUndefined();
    expect(saved?.locationVerification).toBeUndefined();
    const metadata = await t.run((ctx) => ctx.db.query('reportMetadata').first());
    expect(metadata?.formDurationMs).toBe(10000);
    expect(metadata?.userAgent).toBeUndefined();
    expect(metadata?.timezone).toBeUndefined();
  });

  it('redacts legacy hidden photo metadata from all common public report reads', async () => {
    const { t, sessionToken, user, photoStorageIds } = await setup();
    const id = await t.mutation(api.hotspots.create, { ...report, sessionToken, photoStorageIds });
    await t.run((ctx) =>
      ctx.db.patch(id, {
        photoExifData: [{ lat: 40.5, lng: -105.5, timestamp: 'private-photo-time' }],
        locationVerification: { photoHasGps: true, status: 'verified' },
      }),
    );
    const detail = await t.query(api.hotspots.getById, { hotspotId: id });
    const bounds = await t.query(api.hotspots.getByBounds, {
      minLat: 39.55,
      maxLat: 40,
      minLng: -105.15,
      maxLng: -104.55,
    });
    const byUser = await t.query(api.hotspots.getByUser, { userId: user._id });
    const list = await t.query(api.hotspots.list, {
      paginationOpts: { numItems: 20, cursor: null },
    });
    for (const returned of [detail, ...bounds, ...byUser, ...list.page]) {
      expect(returned).toMatchObject({ _id: id, lat: report.lat, lng: report.lng });
      expect(returned).not.toHaveProperty('photoExifData');
      expect(returned).not.toHaveProperty('locationVerification');
    }
  });
});
