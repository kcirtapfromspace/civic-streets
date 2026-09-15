import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('clean up abandoned photo uploads', { minutes: 15 }, internal.storage.cleanupUploads);
crons.interval('clean up geocoding cache and limits', { hours: 1 }, internal.geocoding.cleanup);

// Purge rate-limit records older than 48 hours every 6 hours.
// Keeps the rateLimits table small and ensures stale data doesn't
// accumulate if cleanup is delayed.
crons.interval(
  'purge old rate limits',
  { hours: 6 },
  internal.rateLimit.purgeOldRateLimits,
);

export default crons;
