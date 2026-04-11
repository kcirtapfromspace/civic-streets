import imageCompression from 'browser-image-compression';
import exifr from 'exifr';

export interface PhotoExifData {
  lat?: number;
  lng?: number;
  timestamp?: string;
  orientation?: number;
}

export interface ProcessedImage {
  blob: Blob;
  exif: PhotoExifData | null;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  // 1. Extract EXIF GPS data
  let exif: PhotoExifData | null = null;
  try {
    const gps = await exifr.gps(file);
    const parsed = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'Orientation'],
    });
    if (gps || parsed) {
      exif = {
        lat: gps?.latitude,
        lng: gps?.longitude,
        timestamp: parsed?.DateTimeOriginal?.toISOString?.() ?? undefined,
        orientation: parsed?.Orientation,
      };
    }
  } catch {
    // No EXIF data or unsupported format — that's fine
    exif = null;
  }

  // 2. Compress image
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
  });

  return { blob: compressed, exif };
}

export async function processImages(
  files: File[],
): Promise<ProcessedImage[]> {
  return Promise.all(files.map(processImage));
}

function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function computeLocationVerification(
  reportedLat: number,
  reportedLng: number,
  exifDataArray: PhotoExifData[],
): {
  photoHasGps: boolean;
  distanceMeters?: number;
  status: 'verified' | 'inconsistent' | 'no_gps';
} {
  const withGps = exifDataArray.find(
    (e) => e.lat !== undefined && e.lng !== undefined,
  );

  if (!withGps || withGps.lat === undefined || withGps.lng === undefined) {
    return { photoHasGps: false, status: 'no_gps' };
  }

  const distanceMeters = haversine(
    reportedLat,
    reportedLng,
    withGps.lat,
    withGps.lng,
  );

  return {
    photoHasGps: true,
    distanceMeters,
    status: distanceMeters < 500 ? 'verified' : 'inconsistent',
  };
}
