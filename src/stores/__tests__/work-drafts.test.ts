import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useWorkDraftsStore, WORK_DRAFTS_KEY, type StreetWork, type IntersectionWork } from '../work-drafts-store';
import { useProposalStore } from '../proposal-store';
import { useIntersectionStore } from '../intersection-store';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { INTERSECTION_PRESETS } from '@/lib/presets/intersection-presets';
import { saveObservationBrief } from '@/features/community/observation-brief-store';
import { loadTemplates } from '@/lib/templates';
const now = '2026-09-27T12:00:00.000Z';
const context = { concern: 'An inaccessible crossing', desiredOutcome: 'A clear path', requestedNextStep: 'A site visit', dimensionBasis: 'assumed' as const, dimensionSource: '' };
const place = { lat: 39.7, lng: -104.9, address: 'Broadway' };
const street: StreetWork = { kind: 'street', id: 'street', name: 'Broadway', location: place, createdAt: now, updatedAt: now, briefContext: context, step: 'concern', roadPath: [place], bearing: 0, beforePresetId: null, beforeStreet: null, afterStreet: null, selectedTemplateId: null, showBeforeOnMap: true };
const intersection: IntersectionWork = { kind: 'intersection', id: 'intersection', name: 'Main at Broadway', location: place, createdAt: now, updatedAt: now, briefContext: context, step: 'improvements', center: place, conditions: INTERSECTION_PRESETS[0].conditions, selectedImprovements: ['curb-ramps'], crashSummary: { totalCrashes: 1, fatalities: 0, severeInjuries: 0, pedestrianCrashes: 1, cyclistCrashes: 0, motoristCrashes: 0, radiusMeters: 75 } };
beforeEach(() => { localStorage.clear(); useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState()); useProposalStore.getState().reset(); useIntersectionStore.getState().reset(); });
afterEach(() => vi.restoreAllMocks());

it('saves every street stage under one identity and reopens the exact partially edited stage after a reload', () => {
  const store = useProposalStore.getState();
  store.initProposal('Broadway', place);
  store.setBriefContext(context);
  store.continueToExplore();
  store.selectPreset(BEFORE_PRESETS[0]);
  const id = useProposalStore.getState().proposalId!;
  store.reset();
  useWorkDraftsStore.setState({ drafts: {} });
  useWorkDraftsStore.getState().load();
  const draft = useWorkDraftsStore.getState().drafts[id] as StreetWork;
  expect(draft).toMatchObject({ step: 'before-selected', briefContext: context, beforePresetId: BEFORE_PRESETS[0].id });
  store.loadWork(draft);
  expect(useProposalStore.getState().selectedPreset).toEqual(BEFORE_PRESETS[0]);
  store.applyTransformation(loadTemplates()[0]);
  store.toggleMapView();
  expect(useProposalStore.getState().hasUnsavedChanges()).toBe(false);
  expect(Object.keys(useWorkDraftsStore.getState().drafts)).toEqual([id]);
  store.prepareBrief();
  store.goBack();
  expect(useProposalStore.getState().step).toBe('concern');
  store.initConcern('At the library entrance');
  expect(useProposalStore.getState().getWork()).toMatchObject({ location: null, name: 'At the library entrance' });
  store.reset();
  expect(store.saveWork()).toBe(true);
  expect(store.hasUnsavedChanges()).toBe(false);
});

it('saves and reopens intersections including purpose, selected improvements and stable identity', () => {
  const store = useIntersectionStore.getState();
  store.initIntersection('Main at Broadway', place, place);
  store.setBriefContext(context);
  store.selectConditions(INTERSECTION_PRESETS[0].conditions);
  store.toggleImprovement('curb-ramps');
  store.advanceToReview();
  const proposal = store.getProposal()!;
  expect(store.getProposal()?.id).toBe(proposal.id);
  store.reset();
  useWorkDraftsStore.getState().load();
  store.loadWork(useWorkDraftsStore.getState().drafts[proposal.id] as IntersectionWork);
  expect(store.getProposal()).toMatchObject({ id: proposal.id, metadata: { createdAt: proposal.metadata.createdAt }, selectedImprovements: ['curb-ramps'] });
  expect(useIntersectionStore.getState().briefContext).toEqual(context);
  store.initIntersection('North entrance', null, null);
  const nameOnly = store.getWork()!;
  expect(nameOnly).toMatchObject({ location: null, center: null, conditions: null });
  useWorkDraftsStore.getState().load();
  expect(useWorkDraftsStore.getState().drafts[nameOnly.id]).toMatchObject({ center: null });
  expect(store.getProposal()).toBeNull();
  store.reset();
  expect(store.saveWork()).toBe(true);
});

it('preserves earlier storage, keeps failed edits for retry, and carries archive/follow-up metadata through later edits', () => {
  const store = useWorkDraftsStore.getState();
  expect(store.save(street)).toBe(true);
  expect(store.update('missing', {})).toBe(false);
  expect(store.update('constructor', {})).toBe(false);
  expect(store.update(street.id, { followUp: 'Asked for a site visit', archived: true })).toBe(true);
  const earlier = localStorage.getItem(WORK_DRAFTS_KEY);
  const block = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  expect(store.save({ ...street, followUp: 'A reply arrived', archived: false })).toBe(false);
  expect(store.save(intersection)).toBe(false);
  expect(store.retry()).toBe(false);
  expect(localStorage.getItem(WORK_DRAFTS_KEY)).toBe(earlier);
  store.load();
  expect(useWorkDraftsStore.getState().storageError).toContain('latest work');
  block.mockRestore();
  // A geometry edit should not erase the pending note on the same draft.
  expect(store.save(street)).toBe(true);
  expect(useWorkDraftsStore.getState().drafts[street.id]).toMatchObject({ followUp: 'A reply arrived', archived: false });
  expect(useWorkDraftsStore.getState().storageError).toBeTruthy();
  expect(store.retry()).toBe(true);
  expect(useWorkDraftsStore.getState()).toMatchObject({ pending: {}, storageError: null });
  store.load();
  expect(useWorkDraftsStore.getState().drafts.intersection).toMatchObject(intersection);
  expect(store.save({ ...street, name: 'Revised name' })).toBe(true);
  expect(useWorkDraftsStore.getState().drafts.street.followUp).toBe('A reply arrived');
});

it('reports browser read failure without discarding its last readable work', () => {
  const store = useWorkDraftsStore.getState();
  store.save(street);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  store.load();
  expect(useWorkDraftsStore.getState()).toMatchObject({ storageError: expect.stringContaining('could not be read'), drafts: { street: expect.objectContaining({ name: 'Broadway' }) } });
});

it.each(['{', 'null', '[]', '{}', '{"version":2,"drafts":[]}', '{"version":1,"drafts":null}'])('retains unsupported storage %s', (raw) => {
  localStorage.setItem(WORK_DRAFTS_KEY, raw);
  useWorkDraftsStore.getState().load();
  expect(useWorkDraftsStore.getState().storageError).toContain('could not be read');
  expect(useWorkDraftsStore.getState().save(street)).toBe(false);
  expect(localStorage.getItem(WORK_DRAFTS_KEY)).toBe(raw);
});

it.each([
  ['street', '', null], ['street', 'id', ''], ['street', 'id', 2], ['street', 'name', null], ['street', 'location', {}], ['street', 'location.lat', 100], ['street', 'location.address', 2],
  ['street', 'createdAt', null], ['street', 'createdAt', 'bad'], ['street', 'updatedAt', null], ['street', 'updatedAt', 'bad'], ['street', 'briefContext', null],
  ['street', 'archived', 'yes'], ['street', 'followUp', false], ['street', 'step', 'unknown'], ['street', 'roadPath', null], ['street', 'roadPath.0', null],
  ['street', 'bearing', null], ['street', 'beforePresetId', 2], ['street', 'selectedTemplateId', {}], ['street', 'showBeforeOnMap', null], ['street', 'beforeStreet', {}], ['street', 'afterStreet', {}],
  ['intersection', 'kind', 'unknown'], ['intersection', 'step', 'concern'], ['intersection', 'center', {}], ['intersection', 'selectedImprovements', null], ['intersection', 'selectedImprovements.0', 1],
  ['intersection', 'conditions', 2], ['intersection', 'conditions.shape', 'unknown'], ['intersection', 'conditions.trafficControl', 'unknown'], ['intersection', 'conditions.crossingType', 'unknown'], ['intersection', 'conditions.hasCurbRamps', 'yes'],
  ['intersection', 'crashSummary', false], ['intersection', 'crashSummary.totalCrashes', -1], ['intersection', 'crashSummary.fatalities', 'none'],
] as const)('rejects invalid %s %s while retaining the source', (kind, path, value) => {
  let draft: unknown = JSON.parse(JSON.stringify(kind === 'street' ? street : intersection));
  if (!path) draft = value;
  else {
    const keys = path.split('.');
    let parent = draft as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
    parent[keys.at(-1)!] = value;
  }
  const raw = JSON.stringify({ version: 1, drafts: [draft] });
  localStorage.setItem(WORK_DRAFTS_KEY, raw);
  useWorkDraftsStore.getState().load();
  expect(useWorkDraftsStore.getState().storageError).toContain('could not be read');
  expect(localStorage.getItem(WORK_DRAFTS_KEY)).toBe(raw);
});


it('carries existing observation purpose and requested next step into a new street concern', () => {
  const observation = { ...place, id: 'observation-1', title: 'Blocked ramp', description: 'A sign blocks the curb ramp', photoUrls: [], createdAt: Date.parse(now), source: 'community' as const };
  saveObservationBrief(observation.id, { desiredOutcome: 'An accessible crossing', requestedNextStep: 'Please move the sign', revisedAt: now });
  useProposalStore.getState().initProposal('Broadway', place, observation);
  expect(useProposalStore.getState().briefContext).toMatchObject({ concern: observation.description, desiredOutcome: 'An accessible crossing', requestedNextStep: 'Please move the sign', sourceUrl: expect.stringContaining('/hotspot/observation-1') });
});
