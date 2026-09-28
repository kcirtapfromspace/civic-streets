import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SavedDrafts } from './SavedDrafts';
import { SavedProposalsLayer } from './SavedProposalsLayer';
import { EditorHUD } from '@/features/map/EditorHUD';
import { MapFake } from '@/features/map/__tests__/map-fake';
import { useSavedProposalsStore, SAVED_PROPOSALS_KEY } from '@/stores/saved-proposals-store';
import { useWorkDraftsStore, WORK_DRAFTS_KEY } from '@/stores/work-drafts-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useDrawingStore } from '@/stores/drawing-store';
import { useMapStore } from '@/features/map/map-store';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { loadTemplates } from '@/lib/templates';
vi.mock('@/features/renderer/CrossSectionSVG', () => ({ CrossSectionSVG: () => <svg aria-label="Street cross section" /> }));
vi.mock('@/features/export', () => ({ generatePDF: vi.fn() }));
const location = { lat: 39.74, lng: -104.99, address: 'Broadway, Denver' };
function ready() {
  const store = useProposalStore.getState();
  store.initProposal('Broadway', location);
  store.setRoadPath([location, { lat: 39.75, lng: -104.99 }], 0);
  store.selectPreset(BEFORE_PRESETS[0]);
  store.applyTransformation(loadTemplates()[0]);
  return store.getProposal()!;
}
beforeEach(() => {
  localStorage.clear();
  useSavedProposalsStore.setState(useSavedProposalsStore.getInitialState());
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  useProposalStore.getState().reset();
  useIntersectionStore.getState().reset();
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useDrawingStore.setState(useDrawingStore.getInitialState());
  useMapStore.setState(useMapStore.getInitialState());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('reloads browser drafts into map overlays and reopens the latest working revision', async () => {
  const proposal = ready();
  useSavedProposalsStore.getState().saveProposal(proposal);
  useProposalStore.getState().reset();
  useSavedProposalsStore.setState({ proposals: {} });
  const map = new MapFake();
  render(<><EditorHUD /><SavedProposalsLayer map={map.asMap()} /></>);
  expect(map.sources.size).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'My work (1)' }));
  expect(screen.getByRole('dialog', { name: 'My work' })).toHaveTextContent('Private to this browser');
  fireEvent.click(screen.getByRole('button', { name: /Reopen Broadway/ }));
  expect(await screen.findByRole('button', { name: 'Save draft' })).toBeInTheDocument();
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'propose', designLocation: location });
  expect(useProposalStore.getState().getProposal()?.id).toBe(proposal.id);
  expect(map.sources.size).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
  expect(screen.getByRole('button', { name: 'My work (1)' })).toBeInTheDocument();
  expect(map.sources.size).toBe(2);
});

it('restores incomplete work after reload, supports an inline entry, and hides the map launcher while drawing', () => {
  const onOpenWork = vi.fn();
  const view = render(<SavedDrafts onOpenWork={onOpenWork} />);
  fireEvent.click(screen.getByRole('button', { name: 'My work (0)' }));
  expect(screen.getByText(/No active work yet/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
  act(() => {
    useProposalStore.getState().initProposal('', location);
    useProposalStore.getState().setBriefContext({ concern: 'Keep a clear path' });
    useProposalStore.getState().reset();
    useWorkDraftsStore.setState({ drafts: {} });
  });
  fireEvent.click(screen.getByRole('button', { name: 'My work (0)' }));
  fireEvent.click(screen.getByRole('button', { name: /Reopen Street proposal/ }));
  expect(useProposalStore.getState().briefContext.concern).toBe('Keep a clear path');
  expect(onOpenWork).toHaveBeenCalledOnce();
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  act(() => useDrawingStore.getState().setActiveTool('road'));
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<SavedDrafts inline />);
  expect(screen.getByRole('button', { name: 'My work (1)' })).toBeInTheDocument();
});

it('retains old saved proposals and retries unreadable storage without replacing it', () => {
  const proposal = ready();
  proposal.streetName = '';
  delete proposal.briefContext;
  useSavedProposalsStore.getState().saveProposal(proposal);
  useProposalStore.getState().reset();
  localStorage.removeItem(WORK_DRAFTS_KEY);
  const raw = localStorage.getItem(SAVED_PROPOSALS_KEY)!;
  localStorage.setItem(SAVED_PROPOSALS_KEY, '{');
  render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: /My work — storage unavailable/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not be read');
  localStorage.setItem(SAVED_PROPOSALS_KEY, raw);
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading drafts' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Reopen Street proposal/ }));
  expect(useProposalStore.getState()).toMatchObject({ step: 'review', briefContext: { concern: '' } });
});

it('keeps both concerns when switching, and retains follow-up notes through archive and restore', () => {
  useProposalStore.getState().initConcern('Broadway');
  useProposalStore.getState().setBriefContext({ concern: 'An obstructed curb ramp' });
  const firstId = useProposalStore.getState().proposalId!;
  useProposalStore.getState().initConcern('Colfax');
  useProposalStore.getState().setBriefContext({ concern: 'A difficult crossing' });
  render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'My work (2)' }));
  fireEvent.change(screen.getByLabelText('Follow-up for Broadway'), { target: { value: 'Contacted maintenance; waiting for a response.' } });
  fireEvent.click(within(screen.getByRole('button', { name: /Reopen Broadway/ }).closest('li')!).getByRole('button', { name: 'Archive work' }));
  expect(screen.queryByRole('button', { name: /Reopen Broadway/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Show archived work'));
  fireEvent.click(screen.getByRole('button', { name: 'Restore work' }));
  fireEvent.click(screen.getByRole('button', { name: /Reopen Broadway/ }));
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'propose', designLocation: null });
  expect(useProposalStore.getState().briefContext.concern).toBe('An obstructed curb ramp');
  useWorkDraftsStore.getState().load();
  expect(useWorkDraftsStore.getState().drafts[firstId]).toMatchObject({ archived: false, followUp: 'Contacted maintenance; waiting for a response.' });
  expect(Object.values(useWorkDraftsStore.getState().drafts)).toHaveLength(2);
});

it.each([location, null])('reopens a durable intersection with location %s', (place) => {
  useIntersectionStore.getState().initIntersection('', place, place);
  useIntersectionStore.getState().setBriefContext({ requestedNextStep: 'Please review the crossing' });
  useIntersectionStore.getState().reset();
  render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'My work (1)' }));
  fireEvent.click(screen.getByRole('button', { name: /Reopen Intersection concept/ }));
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'propose-intersection', designLocation: place });
  expect(useIntersectionStore.getState().briefContext.requestedNextStep).toBe('Please review the crossing');
});

it('keeps failed edits open, allows retry, and does not lose follow-up text when storage is blocked', () => {
  const saved = ready();
  useSavedProposalsStore.getState().saveProposal(saved);
  useProposalStore.getState().initConcern('Second concern');
  render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'My work (2)' }));
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  act(() => useProposalStore.getState().setBriefContext({ concern: 'Unsaved local edit' }));
  fireEvent.change(screen.getByLabelText('Follow-up for Broadway'), { target: { value: 'Keep this note' } });
  expect(screen.getByLabelText('Follow-up for Broadway')).toHaveValue('Keep this note');
  fireEvent.click(screen.getByRole('button', { name: /Reopen Broadway/ }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(useProposalStore.getState().briefContext.concern).toBe('Unsaved local edit');
  blocked.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving current work' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('protects unsaved work when reopening a legacy map draft, including named and unnamed drafts', async () => {
  const saved = ready();
  useSavedProposalsStore.getState().saveProposal(saved);
  // Simulate a browser saved before the unified work store existed.
  localStorage.removeItem(WORK_DRAFTS_KEY);
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  useProposalStore.getState().initConcern('');
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  useProposalStore.getState().setBriefContext({ concern: 'Still editing' });
  const map = new MapFake();
  Object.assign(map, { queryRenderedFeatures: () => [{ layer: { id: `saved-${saved.id}-element-fill-0` } }] });
  render(<SavedProposalsLayer map={map.asMap()} />);
  await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
  expect(screen.getByRole('dialog', { name: 'Replace unsaved work?' })).toHaveTextContent('your current proposal');
  fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
  await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
  fireEvent.keyDown(document, { key: 'Escape' });
  await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes and open draft' }));
  expect(useProposalStore.getState().streetName).toBe('Broadway');
  blocked.mockRestore();
});


it('starts a words-first private concern and keeps the current draft when browser storage blocks a switch', () => {
  const onOpenWork = vi.fn();
  render(<SavedDrafts inline onOpenWork={onOpenWork} />);
  fireEvent.click(screen.getByRole('button', { name: 'My work (0)' }));
  expect(screen.getByRole('button', { name: 'New private concern' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Describe the place'), { target: { value: '  Library entrance  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'New private concern' }));
  expect(useProposalStore.getState()).toMatchObject({ streetName: 'Library entrance', location: null });
  expect(onOpenWork).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'My work (1)' }));
  expect(screen.getByLabelText('Describe the place')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Describe the place'), { target: { value: 'Second place' } });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  fireEvent.click(screen.getByRole('button', { name: 'New private concern' }));
  expect(useProposalStore.getState().streetName).toBe('Library entrance');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
