// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { ASSISTANCE_MODEL, ASSISTANCE_UNAVAILABLE } from '../shared/report-assistance';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const input = { description: 'A parked car blocks the curb ramp every morning.', lat: 39.7392, lng: -104.9903 };
const fetchMock = vi.fn();
const answer = (choice: string, confidence = 0.95) => ({ type: 'choice', choice, confidence });
function provider(relatedCount = 0) {
  return { model: ASSISTANCE_MODEL, answers: {
    issue: answer('vehicle-blocking'), location: answer('missing'), timing: answer('provided'), impact: answer('not_needed'),
    ...Object.fromEntries(Array.from({ length: relatedCount }, (_, i) => [`related_${i}`, { type: 'noul', noul: 0.92 }])),
  } };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
async function setup() {
  const t = convexTest(schema, modules);
  const first = await t.mutation(api.users.createAnonymousUser, {});
  const second = await t.mutation(api.users.createAnonymousUser, {});
  await t.run(async (ctx) => {
    await ctx.db.patch(first.user!._id, { reputation: 100 });
    await ctx.db.patch(second.user!._id, { reputation: 100 });
  });
  return { t, first, second, args: { ...input, sessionToken: first.sessionToken } };
}
function hotspot(userId: NonNullable<Awaited<ReturnType<typeof setup>>['first']['user']>['_id']) {
  return { userId, ...input, title: 'Curb ramp blocked', address: 'Denver', category: 'other', severity: 'high', status: 'open', upvotes: 0, commentCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
}
function submission(sessionToken: string) {
  return { ...input, sessionToken, title: 'My original title', address: 'Denver', category: 'poor-sidewalk', severity: 'low', issueType: 'blocked-sidewalk' };
}

beforeEach(() => {
  vi.stubEnv('TYPESAFE_API_KEY', 'test-private-provider-key');
  vi.stubEnv('REPORT_ASSISTANCE_ENABLED', 'true');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockImplementation(async (_url, init) => json(provider(JSON.parse(init.body).state.nearby_reports.length)));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('report assistance', () => {
  it('suggests existing types, asks only missing details, and sends minimal text to the fixed provider', async () => {
    const { t, first, args } = await setup();
    const related = await t.run((ctx) => ctx.db.insert('hotspots', { ...hotspot(first.user!._id), photoUrls: ['private-photo'], photoExifData: [{ lat: 1 }] }));
    const result = await t.action(api.reportAssistance.suggest, args);
    expect(result).toMatchObject({ suggestedIssueType: 'vehicle-blocking', followUps: ['location'], relatedReports: [{ id: related, title: 'Curb ramp blocked' }] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.redirect).toBe('error');
    expect(init.headers.Authorization).toBe('Bearer test-private-provider-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe(ASSISTANCE_MODEL);
    expect(body.state).toEqual({ new_report: input.description, nearby_reports: [{ title: 'Curb ramp blocked', description: input.description }] });
    expect(init.body).not.toContain(args.sessionToken);
    expect(init.body).not.toContain('private-photo');
    expect(body.questions.issue.criteria).toHaveProperty('unknown');
    const record = await t.run((ctx) => ctx.db.get(result.id));
    expect(record).toMatchObject({ userId: first.user!._id, ...input, model: ASSISTANCE_MODEL, criteriaVersion: 'report-intake-v1', classification: { choice: 'vehicle-blocking', confidence: 0.95 } });
    expect(JSON.stringify(record)).not.toContain('test-private-provider-key');
    expect(record?.expiresAt).toBeGreaterThan(record!.createdAt);
  });

  it('retrieves only nearby unresolved reports, caps candidates, and limits description length', async () => {
    const { t, first, args } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert('hotspots', { ...hotspot(first.user!._id), title: 'resolved', status: 'resolved' });
      await ctx.db.insert('hotspots', { ...hotspot(first.user!._id), title: 'distant longitude', lng: input.lng + 0.01 });
      await ctx.db.insert('hotspots', { ...hotspot(first.user!._id), title: 'distant latitude', lat: input.lat + 0.003 });
      for (let i = 0; i < 7; i++) await ctx.db.insert('hotspots', { ...hotspot(first.user!._id), title: `Candidate ${i}`, lng: input.lng + i * 0.0001, description: 'x'.repeat(1200) });
    });
    const result = await t.action(api.reportAssistance.suggest, args);
    expect(result.relatedReports.map((r) => r.title)).toEqual(Array.from({ length: 5 }, (_, i) => `Candidate ${i}`));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).state.nearby_reports[0].description).toHaveLength(1000);
  });

  it.each([['unknown', 0.99], ['vehicle-blocking', 0.79]])('withholds uncertain classification %s at %s', async (category, confidence) => {
    const { t, args } = await setup();
    fetchMock.mockResolvedValueOnce(json({ ...provider(), answers: { ...provider().answers, issue: answer(category, confidence), location: answer('missing', 0.79) } }));
    expect(await t.action(api.reportAssistance.suggest, args)).toMatchObject({ suggestedIssueType: null, followUps: [], relatedReports: [] });
  });

  it('uses inclusive thresholds and does not describe a weak duplicate match as related', async () => {
    const { t, first, args } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert('hotspots', hotspot(first.user!._id));
      await ctx.db.insert('hotspots', { ...hotspot(first.user!._id), title: 'Different incident' });
    });
    fetchMock.mockResolvedValueOnce(json({ model: ASSISTANCE_MODEL, answers: { ...provider(2).answers, issue: answer('other', 0.8), location: answer('missing', 0.8), related_0: { type: 'noul', noul: 0.85 }, related_1: { type: 'noul', noul: 0.84 } } }));
    expect(await t.action(api.reportAssistance.suggest, args)).toMatchObject({ suggestedIssueType: 'other', followUps: ['location'], relatedReports: [{ title: 'Curb ramp blocked' }] });
  });

  it.each([
    { description: '' }, { description: 'x'.repeat(9) }, { description: 'x'.repeat(5001) },
    { lat: NaN }, { lng: Infinity }, { lat: 0, lng: 0 },
  ])('rejects invalid draft %j before provider access', async (invalid) => {
    const { t, args } = await setup();
    await expect(t.action(api.reportAssistance.suggest, { ...args, ...invalid })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await t.run((ctx) => ctx.db.query('rateLimits').take(1))).toEqual([]);
  });

  it.each([10, 5000])('accepts description length boundary %s', async (length) => {
    const { t, args } = await setup();
    await expect(t.action(api.reportAssistance.suggest, { ...args, description: 'x'.repeat(length) })).resolves.toHaveProperty('id');
  });

  it('requires an existing session and cannot spend another user’s quota', async () => {
    const { t, args, second } = await setup();
    await expect(t.action(api.reportAssistance.suggest, { ...args, sessionToken: 'invalid' })).rejects.toThrow('Invalid session');
    expect(fetchMock).not.toHaveBeenCalled();
    for (let i = 0; i < 10; i++) await t.action(api.reportAssistance.suggest, args);
    await expect(t.action(api.reportAssistance.suggest, args)).rejects.toThrow('Suggestion limit');
    expect(fetchMock).toHaveBeenCalledTimes(10);
    await expect(t.action(api.reportAssistance.suggest, { ...args, sessionToken: second.sessionToken })).resolves.toHaveProperty('id');
    expect(await t.mutation(api.hotspots.create, submission(args.sessionToken))).toBeTruthy();
  });

  it.each([['REPORT_ASSISTANCE_ENABLED', 'false'], ['TYPESAFE_API_KEY', '']])('fails open for reporting when %s is unavailable', async (name, value) => {
    const { t, args } = await setup();
    vi.stubEnv(name, value);
    await expect(t.action(api.reportAssistance.suggest, args)).rejects.toThrow(ASSISTANCE_UNAVAILABLE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await t.mutation(api.hotspots.create, submission(args.sessionToken))).toBeTruthy();
  });

  it.each([
    ['null', null], ['array', []], ['missing answers', { model: ASSISTANCE_MODEL }], ['wrong model', { ...provider(), model: 'jev-latest' }],
    ['invalid category', { ...provider(), answers: { ...provider().answers, issue: answer('invented') } }],
    ['incorrect type', { ...provider(), answers: { ...provider().answers, issue: { ...answer('other'), type: 'score' } } }],
    ['non-string category', { ...provider(), answers: { ...provider().answers, issue: { ...answer('other'), choice: 1 } } }],
    ['negative confidence', { ...provider(), answers: { ...provider().answers, issue: answer('other', -1) } }],
    ['large confidence', { ...provider(), answers: { ...provider().answers, issue: answer('other', 1.1) } }],
    ['null confidence', { ...provider(), answers: { ...provider().answers, issue: { ...answer('other'), confidence: null } } }],
    ['missing check', { model: ASSISTANCE_MODEL, answers: { issue: answer('other') } }],
  ])('rejects %s without persisting bad advice or leaking provider output', async (_label, body) => {
    const { t, args } = await setup();
    fetchMock.mockResolvedValueOnce(json(body));
    await expect(t.action(api.reportAssistance.suggest, args)).rejects.toThrow(ASSISTANCE_UNAVAILABLE);
    expect(await t.run((ctx) => ctx.db.query('reportAssistance').take(1))).toEqual([]);
  });

  it.each([{ type: 'choice', noul: 1 }, { type: 'noul', noul: 'yes' }])('rejects malformed related answer %j', async (bad) => {
    const { t, first, args } = await setup();
    await t.run((ctx) => ctx.db.insert('hotspots', hotspot(first.user!._id)));
    fetchMock.mockResolvedValueOnce(json({ ...provider(), answers: { ...provider().answers, related_0: bad } }));
    await expect(t.action(api.reportAssistance.suggest, args)).rejects.toThrow(ASSISTANCE_UNAVAILABLE);
  });

  it.each([
    ['rate limited', () => json({ secret: 'private provider message' }, 429)],
    ['empty body', () => new Response(null)],
    ['bad JSON', () => new Response('not JSON')],
    ['oversized', () => new Response('x'.repeat(32769))],
  ])('handles %s with a safe message and allows a retry', async (_label, response) => {
    const { t, args } = await setup();
    fetchMock.mockResolvedValueOnce(response());
    await expect(t.action(api.reportAssistance.suggest, args)).rejects.toThrow(ASSISTANCE_UNAVAILABLE);
    await expect(t.action(api.reportAssistance.suggest, args)).resolves.toHaveProperty('id');
    expect(await t.run((ctx) => ctx.db.query('reportAssistance').take(2))).toHaveLength(1);
  });

  it('times out a slow request without leaving an advice record', async () => {
    vi.useFakeTimers();
    const { t, args } = await setup();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('private network error')));
      started();
    }));
    const pending = expect(t.action(api.reportAssistance.suggest, args)).rejects.toThrow(ASSISTANCE_UNAVAILABLE);
    await ready;
    await vi.advanceTimersByTimeAsync(8000);
    await pending;
    expect(await t.run((ctx) => ctx.db.query('reportAssistance').take(1))).toEqual([]);
  });

  it('attaches advice privately and records an override without changing the submitted report', async () => {
    const { t, args } = await setup();
    const advice = await t.action(api.reportAssistance.suggest, args);
    const id = await t.mutation(api.hotspots.create, { ...submission(args.sessionToken), reportAssistanceId: advice.id });
    expect(await t.run((ctx) => ctx.db.get(advice.id))).toMatchObject({ hotspotId: id, selectedIssueType: 'blocked-sidewalk' });
    expect(await t.run((ctx) => ctx.db.get(advice.id))).not.toHaveProperty('expiresAt');
    const saved = await t.query(api.hotspots.getById, { hotspotId: id });
    expect(saved).toMatchObject({ description: input.description, title: 'My original title', severity: 'low', issueType: 'blocked-sidewalk' });
    expect(saved).not.toHaveProperty('classification');
    expect(saved).not.toHaveProperty('reportAssistanceId');
  });

  it.each(['foreign', 'expired', 'changed text', 'changed latitude', 'changed longitude', 'replayed', 'deleted'])('ignores %s advice without preventing a report', async (scenario) => {
    const { t, args, second } = await setup();
    const advice = await t.action(api.reportAssistance.suggest, args);
    const data = submission(scenario === 'foreign' ? second.sessionToken : args.sessionToken);
    if (scenario === 'changed text') data.description += ' Additional observation.';
    if (scenario === 'changed latitude') data.lat += 0.001;
    if (scenario === 'changed longitude') data.lng += 0.001;
    await t.run(async (ctx) => {
      if (scenario === 'expired') await ctx.db.patch(advice.id, { expiresAt: Date.now() - 1 });
      if (scenario === 'replayed') {
        const existing = await ctx.db.insert('hotspots', hotspot(second.user!._id));
        await ctx.db.patch(advice.id, { hotspotId: existing, expiresAt: undefined });
      }
      if (scenario === 'deleted') await ctx.db.delete(advice.id);
    });
    const id = await t.mutation(api.hotspots.create, { ...data, reportAssistanceId: advice.id });
    expect(id).toBeTruthy();
    expect((await t.run((ctx) => ctx.db.get(advice.id)))?.hotspotId).not.toBe(id);
  });

  it('cleans up only expired unattached drafts in bounded batches', async () => {
    const { t, args } = await setup();
    const advice = await t.action(api.reportAssistance.suggest, args);
    const record = (await t.run((ctx) => ctx.db.get(advice.id)))!;
    await t.mutation(api.hotspots.create, { ...submission(args.sessionToken), reportAssistanceId: advice.id });
    await t.run(async (ctx) => {
      const { _id: _id, _creationTime: _creationTime, ...fields } = record;
      void _id; void _creationTime;
      for (let i = 0; i < 101; i++) await ctx.db.insert('reportAssistance', { ...fields, expiresAt: Date.now() - 1 });
      await ctx.db.insert('reportAssistance', { ...fields, expiresAt: Date.now() + 3600000 });
    });
    await t.mutation(internal.reportAssistance.cleanup, {});
    expect(await t.run((ctx) => ctx.db.query('reportAssistance').take(200))).toHaveLength(3);
    await t.mutation(internal.reportAssistance.cleanup, {});
    expect(await t.run((ctx) => ctx.db.query('reportAssistance').take(200))).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.get(advice.id))).not.toBeNull();
  });
});
