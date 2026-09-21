// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
import { historyMonths, monthRange } from '../shared/crash-history';
import type { Doc } from './_generated/dataModel';
const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const now = Date.parse('2026-09-21T12:00:00Z');
const bounds = { south:39.6, north:39.9, west:-105.1, east:-104.6 };
const record = { id:'denver-one',source:'denver' as const,date:'2026-09-01',lat:39.7,lng:-105,
 modes:['motorist' as const],severity:'unknown' as const,fatalities:0,injuries:0,injuryCountScope:'serious-only' as const };
const setup = () => convexTest(schema, modules);
async function seed(t: ReturnType<typeof setup>, overrides: Partial<Doc<'crashMonths'>> = {}) {
 return t.run(ctx => ctx.db.insert('crashMonths', { source:'denver',month:'2026-09',run:'run',offset:0,
 startedAt:now,status:'syncing',count:0,fatalities:0,skipped:0,...overrides }));
}
async function save(t: ReturnType<typeof setup>, id: Doc<'crashMonths'>['_id'], extra = {}) {
 return t.mutation(internal.crashArchive.savePage,{id,run:'run',offset:0,nextOffset:1,records:[record],skipped:0,more:false,...extra});
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

describe('atomic monthly archive',()=>{
 it('queues exactly twelve months per city, prevents overlapping starts and reconciles historical revisions',async()=>{
  const t=setup();
  for (let round=0;round<12;round++) {
    expect(await t.mutation(internal.crashArchive.startDaily,{})).toEqual({queued:3});
    expect(await t.mutation(internal.crashArchive.startDaily,{})).toEqual({queued:0});
    await t.run(async ctx=>{for(const row of await ctx.db.query('crashMonths').take(40)) await ctx.db.patch(row._id,{status:'ready',syncedAt:now,activeRun:row.run});});
  }
  const rows=await t.run(ctx=>ctx.db.query('crashMonths').take(40));
  expect(rows.filter(r=>r.source==='denver').map(r=>r.month).sort()).toEqual(historyMonths(now).sort());
  expect(await t.mutation(internal.crashArchive.startDaily,{})).toEqual({queued:0});
  vi.advanceTimersByTime(86400001);
  expect(await t.mutation(internal.crashArchive.startDaily,{})).toEqual({queued:3});
  vi.advanceTimersByTime(31*86400000);
  expect((await t.mutation(internal.crashArchive.startDaily,{})).queued).toBe(3);
  expect((await t.run(ctx=>ctx.db.query('crashMonths').take(40))).every(r=>r.month>='2025-11')).toBe(true);
 });
 it('cleans expired staging generations and old retained generations',async()=>{
  const t=setup();await seed(t,{month:'2025-08',activeRun:'old'});
  const id=await seed(t,{startedAt:now-3600001});
  await t.mutation(internal.crashArchive.startDaily,{});
  expect((await t.run(ctx=>ctx.db.get(id)))?.run).not.toBe('run');
 });
 it('exposes no partial month, publishes once complete, and deduplicates involved-party rows',async()=>{
  const t=setup(),id=await seed(t);
  await save(t,id,{more:true});
  let result=await t.query(api.crashArchive.viewport,{source:'denver',bounds});
  expect(result.crashes).toEqual([]);expect(result.history.months.at(-1)?.count).toBeNull();
  await save(t,id,{offset:1,nextOffset:3,records:[{...record,fatalities:1,injuries:2,modes:['pedestrian']},{...record,id:'denver-two',date:'2026-09-02'}]});
  result=await t.query(api.crashArchive.viewport,{source:'denver',bounds});
  expect(result.crashes).toHaveLength(2);
  expect(result.crashes.find(r=>r.id===record.id)).toMatchObject({fatalities:1,injuries:2,severity:'fatal',modes:['motorist','pedestrian']});
  expect(result.history.months.at(-1)).toMatchObject({count:2,fatalities:1,status:'ready'});
  expect(result.history.latestRecord).toBe('2026-09-02');
  expect(await save(t,id,{offset:1,nextOffset:3})).toBe(false);
 });
 it.each([
  [null,null,2,3,2,3,'fatal'],[2,3,null,null,2,3,'fatal'],[null,null,null,null,null,null,'unknown'],[0,1,0,2,0,2,'severe-injury'],
 ])('merges unknown counts without losing known values',async(a,b,c,d,fatalities,injuries,severity)=>{
  const t=setup(),id=await seed(t);
  await save(t,id,{more:true,records:[{...record,fatalities:a,injuries:b}]});
  await save(t,id,{offset:1,nextOffset:2,records:[{...record,fatalities:c,injuries:d}]});
  expect((await t.query(api.crashArchive.viewport,{source:'denver',bounds})).crashes[0]).toMatchObject({fatalities,injuries,severity});
 });
 it('replaces a whole month including upstream deletions and preserves the prior month on failure',async()=>{
  const t=setup(),id=await seed(t);await save(t,id,{records:[{...record,date:'2026-09-20'}]});
  await t.run(ctx=>ctx.db.patch(id,{run:'next',status:'syncing',offset:0,count:0,fatalities:0,skipped:0}));
  await t.mutation(internal.crashArchive.fail,{id,run:'wrong',error:'ignored'});
  await t.mutation(internal.crashArchive.fail,{id,run:'next',error:'offline'});
  expect((await t.query(api.crashArchive.viewport,{source:'denver',bounds})).crashes).toHaveLength(1);
  await t.run(ctx=>ctx.db.patch(id,{run:'third',status:'syncing'}));
  await save(t,id,{run:'third',nextOffset:0,records:[]});
  expect((await t.query(api.crashArchive.viewport,{source:'denver',bounds})).crashes).toEqual([]);
  await t.mutation(internal.crashArchive.fail,{id,run:'third',error:'late'});
  expect((await t.run(ctx=>ctx.db.get(id)))?.status).toBe('ready');
 });
 it('bounds reads, filters longitude and dates, and retains full monthly counts',async()=>{
  const t=setup(),id=await seed(t);
  await save(t,id,{records:[record,{...record,id:'outside',lng:-110},{...record,id:'older',date:'2026-09-02'}],skipped:2,nextOffset:5});
  const result=await t.query(api.crashArchive.viewport,{source:'denver',bounds,dateRange:{start:'2026-09-01',end:'2026-09-01'}});
  expect(result.crashes).toHaveLength(1);expect(result.history.months.at(-1)?.count).toBe(3);
  expect(result.warnings.join(' ')).toContain('could not be mapped');
  expect((await t.query(api.crashArchive.viewport,{source:'denver',bounds,dateRange:{start:'2020-01-01',end:'2030-01-01'}})).warnings.join(' ')).toContain('beyond the one-year');
 });
 it('warns when the map read budget is reached',async()=>{
  const t=setup(),id=await seed(t);await save(t,id);
  for(let page=0;page<26;page++) await t.run(async ctx=>{for(let i=0;i<200;i++) await ctx.db.insert('crashRecords',{run:'run',record:{...record,id:`${page}-${i}`}});});
  const result=await t.query(api.crashArchive.viewport,{source:'denver',bounds});
  expect(result.crashes).toHaveLength(5000);expect(result.warnings.join(' ')).toContain('5,000');
  await t.mutation(internal.crashArchive.cleanupRun,{run:'run'});
  expect((await t.run(ctx=>ctx.db.query('crashRecords').take(6000))).length).toBe(4951);
 });
 it.each([
  {bounds:{...bounds,south:Infinity}}, {bounds:{...bounds,south:40}}, {bounds:{...bounds,west:0}},
  {bounds:{...bounds,south:-91}}, {bounds:{...bounds,north:91}}, {bounds:{...bounds,west:-181}}, {bounds:{...bounds,east:181}},
  {dateRange:{start:'2026-02-30',end:'2026-09-01'}}, {dateRange:{start:'bad',end:'2026-09-01'}},
  {dateRange:{start:'2026-09-02',end:'2026-09-01'}},
 ])('rejects invalid viewport arguments %j',async extra=>{
  await expect(setup().query(api.crashArchive.viewport,{source:'denver',bounds,...extra})).rejects.toThrow();
 });
 it.each([{nextOffset:-1},{nextOffset:0,more:true},{nextOffset:100001},{records:Array(201).fill(record)},{records:[{...record,source:'chi'}]}])('rejects invalid import pages %j',async extra=>{
  const t=setup(),id=await seed(t);await expect(save(t,id,extra)).rejects.toThrow();
  expect(await t.run(ctx=>ctx.db.query('crashRecords').take(1))).toEqual([]);
 });
 it('rejects expired work and ignores stale action delivery',async()=>{
  const t=setup(),id=await seed(t,{startedAt:now-3600001});
  await expect(save(t,id)).rejects.toThrow('bounds');
  expect(await save(t,id,{run:'wrong'})).toBe(false);
  expect(await t.query(internal.crashArchive.work,{id,run:'run',offset:99})).toBeNull();
  expect(await t.query(internal.crashArchive.work,{id,run:'run',offset:0})).not.toBeNull();
  await t.run(ctx=>ctx.db.delete(id));
  expect(await save(t,id)).toBe(false);
  expect(await t.query(internal.crashArchive.work,{id,run:'run',offset:0})).toBeNull();
  await t.mutation(internal.crashArchive.fail,{id,run:'run',error:'late'});
  await t.mutation(internal.crashArchive.cleanupRun,{run:'empty'});
 });
 it('leaves no work to an obsolete action and records fetch errors without discarding published data',async()=>{
  const t=setup(),id=await seed(t);
  await t.action(internal.crashImport.page,{id,run:'wrong',offset:0});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({features:[]}))));
  await t.action(internal.crashImport.page,{id,run:'run',offset:0});
  expect((await t.run(ctx=>ctx.db.get(id)))?.status).toBe('ready');
  await t.run(ctx=>ctx.db.patch(id,{status:'syncing',run:'next'}));
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue('offline'));
  await t.action(internal.crashImport.page,{id,run:'next',offset:0,attempt:2});
  expect((await t.run(ctx=>ctx.db.get(id)))?.error).toBe('Crash import failed');
  await t.run(ctx=>ctx.db.patch(id,{status:'syncing',run:'last'}));
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  await t.action(internal.crashImport.page,{id,run:'last',offset:0,attempt:2});
  expect((await t.run(ctx=>ctx.db.get(id)))?.error).toBe('offline');
  await t.mutation(internal.crashArchive.startDaily,{});
  expect((await t.run(ctx=>ctx.db.get(id)))?.run).toBe('last');
  await t.run(async ctx=>{for(const row of await ctx.db.query('crashMonths').take(40)) if(row._id!==id) await ctx.db.patch(row._id,{status:'ready',syncedAt:now});});
  await t.mutation(internal.crashArchive.startDaily,{retryErrors:true});
  expect((await t.run(ctx=>ctx.db.get(id)))?.run).not.toBe('last');
 });
 it('retries transient publisher errors without publishing a partial month',async()=>{
  const t=setup(),id=await seed(t);
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('timeout')));
  await t.action(internal.crashImport.page,{id,run:'run',offset:0});
  expect((await t.run(ctx=>ctx.db.get(id)))?.status).toBe('syncing');
  await t.action(internal.crashImport.page,{id,run:'run',offset:0,attempt:1});
  expect((await t.run(ctx=>ctx.db.get(id)))?.status).toBe('syncing');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({features:[]}))));
  await t.action(internal.crashImport.page,{id,run:'run',offset:0,attempt:2});
  expect((await t.run(ctx=>ctx.db.get(id)))?.status).toBe('ready');
 });
 it('uses a bounded calendar window across year boundaries',()=>{
  expect(historyMonths(Date.parse('2026-01-01'))).toHaveLength(12);
  expect(monthRange('2024-02')).toEqual({start:'2024-02-01',next:'2024-03-01',end:'2024-02-29'});
  expect(()=>monthRange('2026-13')).toThrow();
 });
});
