import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeLocationVerification, processImage, processImages } from './process-image';

const { compress, gps, parse } = vi.hoisted(() => ({
  compress: vi.fn(),
  gps: vi.fn(),
  parse: vi.fn(),
}));
vi.mock('browser-image-compression', () => ({ default: compress }));
vi.mock('exifr', () => ({ default: { gps, parse } }));
beforeEach(() => {
  compress.mockReset().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
  gps.mockReset().mockResolvedValue(null);
  parse.mockReset().mockResolvedValue(null);
});

describe('photo preparation', () => {
  it('prepares a bounded JPEG and preserves separately parsed metadata for local verification', async () => {
    const file = new File(['source'], 'photo.png', { type: 'image/png' });
    gps.mockResolvedValue({ latitude: 39.74, longitude: -104.99 });
    parse.mockResolvedValue({ DateTimeOriginal: new Date('2026-09-14T12:00:00Z'), Orientation: 6 });
    const result = await processImage(file);
    expect(result.blob.type).toBe('image/jpeg');
    expect(result.exif).toEqual({
      lat: 39.74,
      lng: -104.99,
      timestamp: '2026-09-14T12:00:00.000Z',
      orientation: 6,
    });
    expect(compress).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ fileType: 'image/jpeg', maxSizeMB: 0.2, maxWidthOrHeight: 1920 }),
    );
  });

  it('can still prepare photos without metadata or when parsing is unsupported', async () => {
    const files = ['first', 'second'].map((name) => new File([name], `${name}.jpg`));
    gps.mockRejectedValueOnce(new Error('Unsupported EXIF'));
    const result = await processImages(files);
    expect(result).toHaveLength(2);
    expect(result.every((image) => image.exif === null && image.blob.type === 'image/jpeg')).toBe(
      true,
    );
    expect(compress.mock.calls.map(([file]) => file)).toEqual(files);
    expect(await processImages([])).toEqual([]);
  });

  it('does not manufacture capture dates when only GPS or an undecodable date is available', async () => {
    gps.mockResolvedValueOnce({ latitude: 0, longitude: 0 });
    const first = await processImage(new File(['a'], 'a.jpg'));
    expect(first.exif).toMatchObject({ lat: 0, lng: 0, timestamp: undefined });
    parse.mockResolvedValue({ DateTimeOriginal: 'unparsed date', Orientation: 1 });
    const second = await processImage(new File(['b'], 'b.jpg'));
    expect(second.exif).toMatchObject({
      lat: undefined,
      lng: undefined,
      timestamp: undefined,
      orientation: 1,
    });
  });

  it('surfaces compression failures so the report form can retain the user draft', async () => {
    compress.mockRejectedValue(new Error('Decode failed'));
    await expect(processImage(new File(['bad'], 'bad.jpg'))).rejects.toThrow('Decode failed');
  });

  it('distinguishes absent GPS, nearby photos, and mismatched locations including zero coordinates', () => {
    expect(computeLocationVerification(0, 0, [{ timestamp: 'date' }, { lat: 0 }])).toEqual({
      photoHasGps: false,
      status: 'no_gps',
    });
    expect(computeLocationVerification(0, 0, [{ lat: 0, lng: 0 }])).toMatchObject({
      photoHasGps: true,
      distanceMeters: 0,
      status: 'verified',
    });
    const near = computeLocationVerification(39.74, -104.99, [{ lat: 39.7401, lng: -104.99 }]);
    expect(near.status).toBe('verified');
    expect(near.distanceMeters).toBeGreaterThan(10);
    expect(computeLocationVerification(0, 0, [{ lat: 0.005, lng: 0 }]).status).toBe('inconsistent');
  });
});
