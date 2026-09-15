import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateHotspot } from '../use-hotspots';
import { MAX_PHOTO_BYTES } from '../../../../shared/photo-upload';

const { createMutation, uploadPhoto, useMutation, useAction } = vi.hoisted(() => ({
  createMutation: vi.fn(),
  uploadPhoto: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation,
  useAction,
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));
vi.mock('../convex-provider', () => ({ convexAvailable: true }));

const report = {
  title: 'Missing curb ramp',
  description: 'Crossing needs a curb ramp',
  category: 'accessibility' as const,
  severity: 'high' as const,
  lat: 39.7392,
  lng: -104.9903,
  address: 'Broadway, Denver, CO',
  photoUrls: [],
};

function photoBlob(size = 5, type = 'image/jpeg'): Blob {
  // jsdom's Blob may not implement arrayBuffer; keep the test focused on the
  // upload protocol while the backend suite validates real image bytes.
  return { size, type, arrayBuffer: async () => new ArrayBuffer(size) } as Blob;
}

describe('create hotspot hook', () => {
  beforeEach(() => {
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    createMutation.mockReset().mockResolvedValue('saved-report-id');
    uploadPhoto.mockReset().mockResolvedValue('uploaded-photo-id');
    useMutation.mockReset().mockReturnValue(createMutation);
    useAction.mockReset().mockReturnValue(uploadPhoto);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('rejects an uninitialized reporting session instead of silently succeeding', async () => {
    const { result } = renderHook(() => useCreateHotspot());
    await expect(result.current(report)).rejects.toThrow(
      'Your reporting session is still getting ready',
    );
    expect(createMutation).not.toHaveBeenCalled();
    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  it('does not create a report after a failed photo upload', async () => {
    localStorage.setItem('curbwise-session', 'session-token');
    uploadPhoto.mockRejectedValue(new Error('Network request failed'));
    const { result } = renderHook(() => useCreateHotspot());
    await expect(
      result.current({
        ...report,
        processedImages: [
          { blob: photoBlob(), exif: { lat: 40, lng: -105, timestamp: '2026-09-14T12:00:00Z' } },
        ],
        formOpenedAt: Date.now() - 10_000,
      }),
    ).rejects.toThrow('A photo could not be uploaded');
    expect(createMutation).not.toHaveBeenCalled();
  });

  it('persists storage IDs without publishing browser-only photo previews', async () => {
    localStorage.setItem('curbwise-session', 'session-token');
    const { result } = renderHook(() => useCreateHotspot());
    await expect(
      result.current({
        ...report,
        photoUrls: ['blob:https://curbwise.test/preview', 'https://external.example/tracker.jpg'],
        processedImages: [
          { blob: photoBlob(), exif: { lat: 40, lng: -105, timestamp: '2026-09-14T12:00:00Z' } },
        ],
        formOpenedAt: Date.now() - 10_000,
      }),
    ).resolves.toBe('saved-report-id');
    expect(createMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        photoStorageIds: ['uploaded-photo-id'],
        photoUrls: [],
        sessionToken: 'session-token',
      }),
    );
    expect(uploadPhoto).toHaveBeenCalledWith({
      sessionToken: 'session-token',
      bytes: expect.any(ArrayBuffer),
      contentType: 'image/jpeg',
    });
    const sent = createMutation.mock.calls[0][0];
    expect(sent).not.toHaveProperty('photoExifData');
    expect(sent).not.toHaveProperty('locationVerification');
    expect(Object.keys(sent.clientMeta)).toEqual(['formDurationMs']);
  });

  it.each([
    ['too many photos', Array.from({ length: 4 }, () => ({ blob: photoBlob(), exif: null }))],
    ['oversized prepared photo', [{ blob: photoBlob(MAX_PHOTO_BYTES + 1), exif: null }]],
    ['active-content MIME', [{ blob: photoBlob(5, 'image/svg+xml'), exif: null }]],
  ])('rejects %s before uploading any bytes', async (_label, processedImages) => {
    localStorage.setItem('curbwise-session', 'session-token');
    const { result } = renderHook(() => useCreateHotspot());
    await expect(result.current({ ...report, processedImages })).rejects.toThrow();
    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(createMutation).not.toHaveBeenCalled();
  });
});
