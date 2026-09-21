import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
const { query }=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('convex/browser',()=>({ConvexHttpClient:class{query=query;}}));
import { fetchCrashesForViewport,crashCache } from '../index';
const bounds={south:39.7,north:39.8,west:-105,east:-104.9};
beforeEach(()=>{vi.stubEnv('VITE_CONVEX_URL','https://test.convex.cloud/');crashCache.clear();query.mockReset();});
afterEach(()=>vi.unstubAllEnvs());
it('reads the backend archive, retains timeline metadata and caches results',async()=>{
 const history={months:[],latestRecord:null,lastSuccess:null};
 query.mockResolvedValue({crashes:[],history});
 const dates={start:'2026-08-01',end:'2026-08-31'};
 const result=await fetchCrashesForViewport(bounds,dates);
 expect(result.sources[0].history).toEqual(history);
 expect(getFunctionName(query.mock.calls[0][0])).toBe('crashArchive:viewport');
 expect(query.mock.calls[0][1]).toMatchObject({source:'denver',dateRange:dates});
 await fetchCrashesForViewport(bounds,dates);expect(query).toHaveBeenCalledOnce();
 crashCache.clear();await fetchCrashesForViewport(bounds);expect(query.mock.calls[1][1]).not.toHaveProperty('dateRange');
});
it('reports a failed archive request without silently switching to a capped public feed',async()=>{
 query.mockRejectedValue(new Error('Archive unavailable'));
 expect((await fetchCrashesForViewport(bounds)).sources[0]).toMatchObject({status:'error',error:'Archive unavailable'});
 expect(fetch).not.toHaveBeenCalled();
});

it('preserves backend partial warnings and handles non-Error failures',async()=>{
 query.mockResolvedValueOnce({crashes:[],warnings:['Import pending'],history:{months:[],latestRecord:null,lastSuccess:null}});
 expect((await fetchCrashesForViewport(bounds)).sources[0]).toMatchObject({status:'partial',warnings:['Import pending']});
 crashCache.clear();query.mockRejectedValueOnce('offline');
 expect((await fetchCrashesForViewport(bounds)).sources[0].error).toBe('The source could not be reached.');
});
