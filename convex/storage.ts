import { mutation } from './_generated/server';
import { Id } from './_generated/dataModel';

// ── Mutations ───────────────────────────────────────────────────────────────

/** Generate a signed upload URL for Convex file storage. */
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve an array of storage IDs to public URLs.
 * Used internally by hotspot queries — not exposed as a Convex query.
 */
export async function resolveStorageUrls(
  ctx: { storage: { getUrl: (id: Id<'_storage'>) => Promise<string | null> } },
  storageIds: Id<'_storage'>[],
): Promise<string[]> {
  const results = await Promise.all(
    storageIds.map((id) => ctx.storage.getUrl(id)),
  );
  return results.filter((url): url is string => url !== null);
}
