import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { fetchArchivePage } from './crashProvider';
import type { Doc } from './_generated/dataModel';
export const page = internalAction({
  args: { id: v.id('crashMonths'), run: v.string(), offset: v.number() },
  handler: async (ctx, args) => {
    const work: Doc<'crashMonths'> | null = await ctx.runQuery(internal.crashArchive.work, args);
    if (!work) return;
    try {
      const result = await fetchArchivePage(work.source, work.month, args.offset);
      await ctx.runMutation(internal.crashArchive.savePage, { ...args, ...result });
    } catch (error) {
      await ctx.runMutation(internal.crashArchive.fail, { id: args.id, run: args.run,
        error: error instanceof Error ? error.message : 'Crash import failed' });
    }
  },
});
