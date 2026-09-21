import { v, ConvexError } from 'convex/values';
import { internalMutation, internalQuery, query } from './_generated/server';
import { internal } from './_generated/api';
import { city, crash } from './crashValidators';
import { CRASH_CITIES, historyMonths, monthRange } from '../shared/crash-history';

const DAY = 86400000;
const LEASE = 60 * 60 * 1000;
export const startDaily = internalMutation({
  args: { retryErrors: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const now = Date.now(), months = historyMonths(now);
    let queued = 0;
    for (const source of CRASH_CITIES) {
      const existing = await ctx.db.query('crashMonths').withIndex('by_source_and_month', q => q.eq('source', source)).take(100);
      for (const old of existing.filter(row => row.month < months[11])) {
        await ctx.scheduler.runAfter(0, internal.crashArchive.cleanupRun, { run: old.run });
        if (old.activeRun && old.activeRun !== old.run) await ctx.scheduler.runAfter(0, internal.crashArchive.cleanupRun, { run: old.activeRun });
        await ctx.db.delete(old._id);
      }
      if (existing.some(row => months.includes(row.month) && row.status === 'syncing' && now - row.startedAt < LEASE)) continue;
      for (const month of months) {
        const old = existing.find(row => row.month === month);
        if (old?.status === 'error' && !args.retryErrors && now - old.startedAt < DAY) continue;
        // Reconcile recent months daily; older completed months monthly for revisions.
        if (old?.status !== 'error' && old?.syncedAt && now - old.syncedAt < (months.indexOf(month) < 2 ? DAY : 30 * DAY)) continue;
        if (old && old.run !== old.activeRun) await ctx.scheduler.runAfter(0, internal.crashArchive.cleanupRun, { run: old.run });
        const fields = { source, month, run: crypto.randomUUID(), offset: 0, startedAt: now,
          status: 'syncing' as const, count: 0, fatalities: 0, skipped: 0, latest: undefined, error: undefined };
        const id = old ? old._id : await ctx.db.insert('crashMonths', fields);
        if (old) await ctx.db.patch(id, fields);
        await ctx.scheduler.runAfter(queued++ * 3000, internal.crashImport.page, { id, run: fields.run, offset: 0 });
        break; // At most one active import per publisher. Completion starts the next month.
      }
    }
    return { queued };
  },
});

export const work = internalQuery({
  args: { id: v.id('crashMonths'), run: v.string(), offset: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    return row && row.run === args.run && row.offset === args.offset && row.status === 'syncing' ? row : null;
  },
});

export const savePage = internalMutation({
  args: { id: v.id('crashMonths'), run: v.string(), offset: v.number(), nextOffset: v.number(),
    records: v.array(crash), skipped: v.number(), more: v.boolean() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.run !== args.run || row.offset !== args.offset || row.status !== 'syncing') return false;
    if (args.records.length > 200 || args.nextOffset < args.offset || (args.more && args.nextOffset === args.offset)
      || args.nextOffset > 100000 || Date.now() - row.startedAt >= LEASE) throw new Error('Archive import exceeded its bounds');
    let count = row.count, fatalities = row.fatalities, latest = row.latest;
    for (const record of args.records) {
      if (record.source !== row.source || !record.date.startsWith(`${row.month}-`)) throw new Error('Record outside import partition');
      const existing = await ctx.db.query('crashRecords').withIndex('by_run_and_id', q => q.eq('run', args.run).eq('record.id', record.id)).unique();
      // Denver can publish multiple involved-party rows for the same incident.
      if (existing) {
        const merged = { ...record,
          fatalities: record.fatalities === null ? existing.record.fatalities : existing.record.fatalities === null ? record.fatalities : Math.max(record.fatalities, existing.record.fatalities),
          injuries: record.injuries === null ? existing.record.injuries : existing.record.injuries === null ? record.injuries : Math.max(record.injuries, existing.record.injuries),
          modes: [...new Set([...existing.record.modes, ...record.modes])],
        };
        if ((merged.fatalities ?? 0) > 0) merged.severity = 'fatal';
        else if (row.source === 'denver' && (merged.injuries ?? 0) > 0) merged.severity = 'severe-injury';
        fatalities += (merged.fatalities ?? 0) - (existing.record.fatalities ?? 0);
        await ctx.db.patch(existing._id, { record: merged });
      } else {
        await ctx.db.insert('crashRecords', { run: args.run, record });
        count++;
        fatalities += record.fatalities ?? 0;
      }
      if (!latest || record.date > latest) latest = record.date;
    }
    const skipped = row.skipped + args.skipped;
    await ctx.db.patch(row._id, { offset: args.nextOffset, count, fatalities, skipped, latest,
      ...(args.more ? {} : { status: 'ready' as const, activeRun: args.run, activeCount: count,
        activeFatalities: fatalities, activeSkipped: skipped, activeLatest: latest, syncedAt: Date.now() }),
    });
    if (args.more) await ctx.scheduler.runAfter(1000, internal.crashImport.page, { id: row._id, run: args.run, offset: args.nextOffset });
    else {
      if (row.activeRun && row.activeRun !== args.run) await ctx.scheduler.runAfter(0, internal.crashArchive.cleanupRun, { run: row.activeRun });
      await ctx.scheduler.runAfter(0, internal.crashArchive.startDaily, {});
    }
    return true;
  },
});

export const fail = internalMutation({
  args: { id: v.id('crashMonths'), run: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.run !== args.run || row.status !== 'syncing') return;
    await ctx.db.patch(row._id, { status: 'error', error: args.error.slice(0, 250) });
    await ctx.scheduler.runAfter(0, internal.crashArchive.cleanupRun, { run: args.run });
    await ctx.scheduler.runAfter(0, internal.crashArchive.startDaily, {});
  },
});
export const cleanupRun = internalMutation({
  args: { run: v.string() },
  handler: async (ctx, { run }) => {
    const rows = await ctx.db.query('crashRecords').withIndex('by_run_and_id', q => q.eq('run', run)).take(250);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 250) await ctx.scheduler.runAfter(0, internal.crashArchive.cleanupRun, { run });
  },
});

export const viewport = query({
  args: { source: city, bounds: v.object({ south: v.number(), west: v.number(), north: v.number(), east: v.number() }),
    dateRange: v.optional(v.object({ start: v.string(), end: v.string() })) },
  handler: async (ctx, { source, bounds, dateRange }) => {
    const { south, west, north, east } = bounds;
    if (![south, west, north, east].every(Number.isFinite) || south >= north || west >= east
      || south < -90 || north > 90 || west < -180 || east > 180) throw new ConvexError('Invalid map bounds');
    if (dateRange && (![dateRange.start, dateRange.end].every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)
      && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date)
      || dateRange.start > dateRange.end)) throw new ConvexError('Invalid date range');
    const months = historyMonths(Date.now());
    const stored = await ctx.db.query('crashMonths').withIndex('by_source_and_month', q => q.eq('source', source).gte('month', months[11]).lte('month', months[0])).take(12);
    const latestRecord = stored.map(row => row.activeLatest ?? '').sort().at(-1) || null;
    const lastSuccess = Math.max(0, ...stored.map(row => row.syncedAt ?? 0)) || null;
    const history = { latestRecord, lastSuccess, months: [...months].reverse().map(month => {
      const row = stored.find(item => item.month === month);
      return { month, count: row?.activeCount ?? null, fatalities: row?.activeFatalities ?? null,
        syncedAt: row?.syncedAt ?? null, skipped: row?.activeSkipped ?? 0,
        status: row?.status === 'error' ? 'error' as const : row?.activeRun ? 'ready' as const : 'pending' as const };
    }) };
    const warnings: string[] = [];
    if (stored.some(row => row.status === 'error')) warnings.push('A scheduled refresh failed. Previously completed months remain available.');
    if (!latestRecord || latestRecord < new Date(Date.now() - 14 * DAY).toISOString().slice(0, 10)) warnings.push('Publisher records are delayed or not yet available. Recent empty periods do not mean zero crashes.');
    if (dateRange && (dateRange.start < `${months[11]}-01` || dateRange.end > new Date().toISOString().slice(0, 10))) warnings.push('Requested dates extend beyond the one-year archive.');
    const crashes = [];
    let budget = 5000;
    for (const month of months) {
      const range = monthRange(month);
      if (dateRange && (range.end < dateRange.start || range.start > dateRange.end)) continue;
      const row = stored.find(item => item.month === month);
      if (!row?.activeRun) { warnings.push(`Import pending for ${month}.`); continue; }
      if (row.activeSkipped) warnings.push(`${month}: ${row.activeSkipped} publisher rows could not be mapped.`);
      const records = await ctx.db.query('crashRecords').withIndex('by_run_and_lat', q => q.eq('run', row.activeRun!).gte('record.lat', south).lte('record.lat', north)).take(budget + 1);
      const limited = records.length > budget;
      for (const { record } of records.slice(0, budget)) {
        if (record.lng >= west && record.lng <= east && (!dateRange || record.date >= dateRange.start && record.date <= dateRange.end)) crashes.push(record);
      }
      budget -= Math.min(records.length, budget);
      if (limited || budget === 0) { warnings.push('Map display is limited to 5,000 scanned records. Zoom in or select a month. City-wide monthly totals remain complete for imported months.'); break; }
    }
    return { crashes, warnings, history };
  },
});
