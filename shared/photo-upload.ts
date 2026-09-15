/** Pilot upload limits, shared for browser feedback and server enforcement. */
export const MAX_REPORT_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 512 * 1024;
export const PHOTO_CONTENT_TYPE = 'image/jpeg';
export const MAX_PHOTO_DIMENSION = 4096;
export const MAX_PHOTO_PIXELS = 16_000_000;

export const UPLOAD_LIMITS = {
  userPerHour: 12,
  userPerDay: 36,
  globalPerHour: 100,
  globalPerDay: 300,
  globalBytesPerDay: 128 * 1024 * 1024,
  // An operator reviews usage before raising this pilot spending ceiling.
  // Failed reservations count, and creating fresh sessions cannot reset it.
  globalLifetimeBytes: 512 * 1024 * 1024,
} as const;

export const PHOTO_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
