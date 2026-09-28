import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useSavedProposalsStore, SAVED_PROPOSALS_KEY } from '../saved-proposals-store';
import { useProposalStore } from '../proposal-store';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { loadTemplates } from '@/lib/templates';
import type { ObservationSnapshot } from '@/lib/types';

const evidence: ObservationSnapshot = {
  id: 'observation-1', title: 'No curb ramp', description: 'The crossing has no step-free access.',
  photoUrls: ['https://images.example/ramp.jpg'], lat: 39.7, lng: -104.9,
  address: 'Broadway, Denver', createdAt: 1790000000000, source: 'community',
};

function ready() {
  const store = useProposalStore.getState();
  store.initProposal('Broadway', { lat: 39.7, lng: -104.9, address: 'Broadway, Denver' });
  store.setRoadPath([{ lat: 39.7, lng: -104.9 }, { lat: 39.71, lng: -104.9 }], 0);
  store.selectPreset(BEFORE_PRESETS[0]);
  store.applyTransformation(loadTemplates()[0]);
  return store.getProposal()!;
}
beforeEach(() => {
  localStorage.clear();
  useSavedProposalsStore.setState(useSavedProposalsStore.getInitialState());
  useProposalStore.getState().reset();
});
afterEach(() => vi.restoreAllMocks());

it('keeps a stable draft identity, snapshots edits, and restores a saved before/after proposal after reload', () => {
  const proposal = ready();
  const store = useSavedProposalsStore.getState();
  store.saveProposal(proposal);
  const firstWidth = proposal.afterStreet.elements[0].width;
  proposal.afterStreet.elements[0].width = 12;
  expect(store.getProposal(proposal.id)?.afterStreet.elements[0].width).toBe(firstWidth);
  const createdAt = proposal.metadata.createdAt;
  useProposalStore.setState({ streetName: 'Broadway revised' });
  const revised = useProposalStore.getState().getProposal()!;
  expect(revised.id).toBe(proposal.id);
  expect(revised.metadata.createdAt).toBe(createdAt);
  store.saveProposal(revised);
  expect(Object.keys(useSavedProposalsStore.getState().proposals)).toHaveLength(1);
  useSavedProposalsStore.setState({ proposals: {} });
  useProposalStore.getState().reset();
  store.loadProposals();
  const restored = store.getProposal(proposal.id)!;
  expect(restored).toEqual(revised);
  useProposalStore.getState().loadProposal(restored);
  expect(useProposalStore.getState().getProposal()).toMatchObject({ id: proposal.id, metadata: { createdAt } });
  store.removeProposal(proposal.id);
  useSavedProposalsStore.setState({ proposals: {} });
  store.loadProposals();
  expect(store.getProposal(proposal.id)).toBeUndefined();
  expect(store.getProposal('constructor')).toBeUndefined();
});

it('leaves saved data unchanged when a storage write or removal fails and retries safely', () => {
  const proposal = ready();
  const store = useSavedProposalsStore.getState();
  store.saveProposal(proposal);
  const original = localStorage.getItem(SAVED_PROPOSALS_KEY);
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
  expect(() => store.saveProposal({ ...proposal, streetName: 'Unsaved change' })).toThrow('Drafts could not be saved');
  expect(store.getProposal(proposal.id)?.streetName).toBe('Broadway');
  expect(localStorage.getItem(SAVED_PROPOSALS_KEY)).toBe(original);
  expect(() => store.removeProposal(proposal.id)).toThrow('could not be removed');
  expect(store.getProposal(proposal.id)).toBeDefined();
  blocked.mockRestore();
  store.saveProposal({ ...proposal, streetName: 'Retry saved' });
  expect(useSavedProposalsStore.getState().storageError).toBeNull();
  expect(store.getProposal(proposal.id)?.streetName).toBe('Retry saved');
});

it('preserves the last readable drafts when storage becomes inaccessible', () => {
  const proposal = ready();
  const store = useSavedProposalsStore.getState();
  store.saveProposal(proposal);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  store.loadProposals();
  expect(useSavedProposalsStore.getState().storageError).toContain('could not be read');
  expect(store.getProposal(proposal.id)).toEqual(proposal);
});

it.each(['{', 'null', '[]', '{}', '{"version":2,"proposals":[]}', '{"version":1,"proposals":null}'])(
  'does not overwrite malformed or unsupported draft storage %s', (raw) => {
    localStorage.setItem(SAVED_PROPOSALS_KEY, raw);
    const store = useSavedProposalsStore.getState();
    store.loadProposals();
    expect(useSavedProposalsStore.getState().storageError).toContain('could not be read');
    expect(() => store.saveProposal(ready())).toThrow('could not be saved');
    expect(localStorage.getItem(SAVED_PROPOSALS_KEY)).toBe(raw);
  },
);

it.each([
  ['id', null], ['id', ''], ['streetName', 3], ['location', null], ['location.lat', 91], ['location.lng', -181], ['location.address', null],
  ['roadPath', null], ['roadPath.0.lat', 'wrong'], ['bearing', null], ['beforePresetId', false], ['transformationTemplateId', null],
  ['beforeStreet', null], ['afterStreet', null], ['metadata', null], ['metadata.createdAt', 3], ['metadata.updatedAt', 'invalid'],
  ['beforeStreet.id', null], ['beforeStreet.name', null], ['beforeStreet.totalROWWidth', null], ['beforeStreet.curbToCurbWidth', null],
  ['beforeStreet.direction', 'invalid'], ['beforeStreet.functionalClass', 'invalid'], ['beforeStreet.metadata', null], ['beforeStreet.elements', null],
  ['beforeStreet.elements.0', null], ['beforeStreet.elements.0.id', null], ['beforeStreet.elements.0.type', null], ['beforeStreet.elements.0.type', 'constructor'],
  ['beforeStreet.elements.0.side', 'invalid'], ['beforeStreet.elements.0.width', null], ['beforeStreet.elements.0.width', -1], ['beforeStreet.elements.0.locked', null],
  ['beforeStreet.elements.0.label', {}], ['beforeStreet.elements.0.variant', {}], ['beforeStreet.elements.0.constraints', null],
  ['beforeStreet.elements.0.constraints.absoluteMin', null], ['beforeStreet.elements.0.constraints.source', null], ['beforeStreet.elements.0.constraints.prowagRequired', null],
] as const)('rejects unreadable proposal field %s without deleting its source', (path, value) => {
  const proposal = JSON.parse(JSON.stringify(ready())) as Record<string, unknown>;
  const keys = path.split('.');
  let record = proposal;
  for (const key of keys.slice(0, -1)) record = record[key] as Record<string, unknown>;
  record[keys[keys.length - 1]] = value;
  const raw = JSON.stringify({ version: 1, proposals: [proposal] });
  localStorage.setItem(SAVED_PROPOSALS_KEY, raw);
  useSavedProposalsStore.getState().loadProposals();
  expect(useSavedProposalsStore.getState().storageError).toContain('could not be read');
  expect(useSavedProposalsStore.getState().proposals).toEqual({});
  expect(localStorage.getItem(SAVED_PROPOSALS_KEY)).toBe(raw);
});

it('can reopen a valid saved element without optional labels or with a variant', () => {
  const proposal = ready();
  delete proposal.beforeStreet.elements[0].label;
  proposal.beforeStreet.elements[0].variant = 'painted';
  const store = useSavedProposalsStore.getState();
  store.saveProposal(proposal);
  store.loadProposals();
  expect(store.getProposal(proposal.id)).toEqual(proposal);
});

it('carries observation evidence and purpose through concern, exploration, save and reload without sharing mutable photos', () => {
  const observation = { ...evidence, photoUrls: [...evidence.photoUrls] };
  const location = { lat: evidence.lat, lng: evidence.lng, address: evidence.address };
  const store = useProposalStore.getState();
  store.initProposal('Broadway', location, observation);
  observation.photoUrls.push('https://images.example/later.jpg');
  location.address = 'Later address';
  expect(useProposalStore.getState()).toMatchObject({
    step: 'concern', location: { address: evidence.address }, briefContext: { concern: evidence.description, observation: evidence, dimensionBasis: 'assumed' },
  });
  expect(store.hasUnsavedChanges()).toBe(true);
  store.setBriefContext({ desiredOutcome: 'Step-free access', requestedNextStep: 'A site visit' });
  store.continueToExplore();
  expect(useProposalStore.getState().step).toBe('street-selected');
  store.goBack();
  expect(useProposalStore.getState().step).toBe('concern');
  expect(useProposalStore.getState().briefContext.desiredOutcome).toBe('Step-free access');
  store.continueToExplore();
  store.selectPreset(BEFORE_PRESETS[0]);
  store.setBriefContext({ dimensionBasis: 'measured', dimensionSource: 'Tape measure, Sept 27' });
  store.applyTransformation(loadTemplates()[0]);
  const proposal = store.getProposal()!;
  useSavedProposalsStore.getState().saveProposal(proposal);
  expect(store.hasUnsavedChanges()).toBe(false);
  proposal.briefContext!.observation!.photoUrls.push('https://images.example/export-copy.jpg');
  expect(useProposalStore.getState().briefContext.observation?.photoUrls).toEqual(evidence.photoUrls);
  store.setBriefContext({ concern: 'Edited concern' });
  expect(store.hasUnsavedChanges()).toBe(true);
  useSavedProposalsStore.setState({ proposals: {} });
  store.reset();
  useSavedProposalsStore.getState().loadProposals();
  const restored = useSavedProposalsStore.getState().getProposal(proposal.id)!;
  expect(restored.briefContext).toMatchObject({ concern: evidence.description, desiredOutcome: 'Step-free access', requestedNextStep: 'A site visit', dimensionSource: 'Tape measure, Sept 27', observation: evidence });
  store.loadProposal(restored);
  const updatedEvidence = { ...evidence, photoUrls: ['https://images.example/update.jpg'] };
  store.setBriefContext({ observation: updatedEvidence });
  updatedEvidence.photoUrls.push('https://images.example/mutation.jpg');
  expect(useProposalStore.getState().briefContext.observation?.photoUrls).toEqual(['https://images.example/update.jpg']);
  expect(restored.briefContext?.observation?.photoUrls).toEqual(evidence.photoUrls);
  store.selectPreset(BEFORE_PRESETS[1]);
  expect(useProposalStore.getState().briefContext).toMatchObject({ dimensionBasis: 'assumed', dimensionSource: '', concern: evidence.description, desiredOutcome: 'Step-free access', observation: { id: evidence.id } });
});

it('opens legacy drafts with empty context without making them falsely dirty, and uses an observation title when notes are empty', () => {
  const proposal = ready();
  delete proposal.briefContext;
  useSavedProposalsStore.getState().saveProposal(proposal);
  useSavedProposalsStore.getState().loadProposals();
  useProposalStore.getState().loadProposal(proposal);
  expect(useProposalStore.getState().briefContext).toEqual({ concern: '', desiredOutcome: '', requestedNextStep: '', dimensionBasis: 'assumed', dimensionSource: '' });
  expect(useProposalStore.getState().hasUnsavedChanges()).toBe(false);
  useProposalStore.getState().initProposal('Broadway', proposal.location, { ...evidence, description: '' });
  expect(useProposalStore.getState().briefContext.concern).toBe(evidence.title);
});

it.each([
  ['briefContext', null], ['briefContext.concern', 3], ['briefContext.desiredOutcome', null],
  ['briefContext.requestedNextStep', []], ['briefContext.dimensionSource', {}], ['briefContext.dimensionBasis', 'surveyed'],
  ['briefContext.observation', null], ['briefContext.observation.id', ''], ['briefContext.observation.id', 1],
  ['briefContext.observation.title', 4], ['briefContext.observation.description', []], ['briefContext.observation.address', null],
  ['briefContext.observation.lat', 91], ['briefContext.observation.lng', -181],
  ['briefContext.observation.createdAt', 'yesterday'], ['briefContext.observation.createdAt', -1],
  ['briefContext.observation.source', 'official'], ['briefContext.observation.photoUrls', {}], ['briefContext.observation.photoUrls.0', null],
] as const)('rejects malformed persisted context field %s while preserving browser data', (path, value) => {
  const proposal = ready();
  proposal.briefContext!.observation = { ...evidence, photoUrls: [...evidence.photoUrls] };
  const record = proposal as unknown as Record<string, unknown>;
  const keys = path.split('.');
  let target = record;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys[keys.length - 1]] = value;
  const raw = JSON.stringify({ version: 1, proposals: [record] });
  localStorage.setItem(SAVED_PROPOSALS_KEY, raw);
  useSavedProposalsStore.getState().loadProposals();
  expect(useSavedProposalsStore.getState().storageError).toContain('could not be read');
  expect(useSavedProposalsStore.getState().proposals).toEqual({});
  expect(localStorage.getItem(SAVED_PROPOSALS_KEY)).toBe(raw);
});
