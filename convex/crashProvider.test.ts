// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchArchivePage, PAGE_SIZE } from './crashProvider';
import type { CrashCity } from '../shared/crash-history';
const chi={crash_record_id:'one',crash_date:'2026-09-01T12:00:00',latitude:'41.8',longitude:'-87.6',injuries_fatal:'0',injuries_total:'1',first_crash_type:'PEDESTRIAN',most_severe_injury:'NONINCAPACITATING INJURY'};
const nyc={collision_id:'two',crash_date:'2026-09-01',latitude:'40.7',longitude:'-74',number_of_persons_killed:'0',number_of_persons_injured:'1',number_of_pedestrians_killed:'0',number_of_pedestrians_injured:'1'};
const denver={incident_id:'three',first_occurrence_date:Date.parse('2026-09-01'),geo_lat:39.7,geo_lon:-105,FATALITIES:0,SERIOUSLY_INJURED:1,pedestrian_ind:1,bicycle_ind:1};
function fixture(source:CrashCity,rows:unknown[],extra={}) {return source==='denver'?{features:rows.map(attributes=>({attributes})),...extra}:rows;}
function mock(data:unknown,status=200) { const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(data),{status}));vi.stubGlobal('fetch',fetcher);return fetcher; }
afterEach(()=>vi.unstubAllGlobals());
describe('archive publisher pages',()=>{
 it.each([['chi',chi,'moderate-injury'],['nyc',nyc,'unknown'],['denver',denver,'severe-injury']] as const)('normalizes %s and uses an ordered month query',async(source,row,severity)=>{
  const fetcher=mock(fixture(source,[row]));const result=await fetchArchivePage(source,'2026-09',200);
  expect(result).toMatchObject({more:false,nextOffset:201,skipped:0,records:[{date:'2026-09-01',severity}]});
  const url=new URL(fetcher.mock.calls[0][0]);expect(url.searchParams.get(source==='denver'?'where':'$where')).toContain('2026-10-01');
  expect(url.searchParams.get(source==='denver'?'resultOffset':'$offset')).toBe('200');
  expect(fetcher.mock.calls[0][1].redirect).toBe('error');
 });
 it.each([
  ['chi',{...chi,most_severe_injury:'INCAPACITATING INJURY',first_crash_type:'PEDALCYCLIST'},'severe-injury',['cyclist']],
  ['chi',{...chi,most_severe_injury:'NO INDICATION OF INJURY',first_crash_type:'ANGLE'},'minor',['motorist']],
  ['chi',{...chi,most_severe_injury:'unrecognized',injuries_fatal:'1'},'fatal',['pedestrian']],
  ['chi',{...chi,most_severe_injury:'unrecognized'},'unknown',['pedestrian']],
  ['nyc',{...nyc,number_of_pedestrians_injured:'0',number_of_cyclist_injured:'1',number_of_motorist_killed:'1',number_of_persons_killed:'1'},'fatal',['cyclist','motorist']],
  ['nyc',{...nyc,number_of_motorist_injured:'1'},'unknown',['pedestrian','motorist']],
  ['nyc',{...nyc,number_of_pedestrians_injured:'0'},'unknown',['motorist']],
  ['denver',{...denver,FATALITIES:null,SERIOUSLY_INJURED:null,pedestrian_ind:0,bicycle_ind:0},'unknown',['motorist']],
 ] as const)('preserves mode and injury semantics %j',async(source,row,severity,modes)=>{
  mock(fixture(source,[row]));expect((await fetchArchivePage(source,'2026-09',0)).records[0]).toMatchObject({severity,modes});
 });
 it.each([null,undefined,'','bad','Infinity','-1','1.5'])('keeps invalid injury counts unknown: %s',async value=>{
  mock([{...chi,injuries_fatal:value,injuries_total:value}]);
  expect((await fetchArchivePage('chi','2026-09',0)).records[0]).toMatchObject({fatalities:null,injuries:null});
 });
 it.each([
  {latitude:null},{longitude:null},{latitude:'0'},{longitude:'0'},{latitude:'91'},{longitude:'181'},
  {crash_record_id:undefined},{crash_record_id:null},{crash_record_id:''},{crash_record_id:'x'.repeat(201)},
  {crash_date:'bad'},{crash_date:'2026-08-31'},{crash_date:'2026-10-01'},
 ])('counts unusable records without inventing map points %j',async extra=>{
  mock([{...chi,...extra}]);expect(await fetchArchivePage('chi','2026-09',0)).toMatchObject({records:[],skipped:1});
 });
 it.each([null,1e20])('rejects unusable Denver timestamps %s',async first_occurrence_date=>{
  mock(fixture('denver',[{...denver,first_occurrence_date}]));expect((await fetchArchivePage('denver','2026-09',0)).skipped).toBe(1);
 });
 it('continues full pages and respects Denver transfer flags',async()=>{
  mock(Array(PAGE_SIZE).fill(chi));expect((await fetchArchivePage('chi','2026-09',0)).more).toBe(true);
  mock(fixture('denver',[denver],{exceededTransferLimit:true}));expect((await fetchArchivePage('denver','2026-09',0)).more).toBe(true);
  mock(fixture('denver',Array(PAGE_SIZE).fill(denver),{exceededTransferLimit:false}));expect((await fetchArchivePage('denver','2026-09',0)).more).toBe(false);
 });
 it.each([
  ['chi',{},200],['chi',[],503],['chi',{error:'bad'},200],['chi',Array(201).fill(chi),200],['chi',[null],200],
  ['denver',{features:[{}]},200],['denver',{features:[],exceededTransferLimit:true},200],['denver',null,200],
 ] as const)('rejects broken upstream responses %s %j',async(source,data,status)=>{
  mock(data,status);await expect(fetchArchivePage(source,'2026-09',0)).rejects.toThrow();
 });
 it('rejects oversized and malformed JSON',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(' '.repeat(2000001))));
  await expect(fetchArchivePage('chi','2026-09',0)).rejects.toThrow('size');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('not-json')));
  await expect(fetchArchivePage('chi','2026-09',0)).rejects.toThrow();
 });
});
