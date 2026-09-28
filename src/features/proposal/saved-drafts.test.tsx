import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SavedDrafts } from './SavedDrafts';
import { SavedProposalsLayer } from './SavedProposalsLayer';
import { EditorHUD } from '@/features/map/EditorHUD';
import { MapFake } from '@/features/map/__tests__/map-fake';
import { useSavedProposalsStore, SAVED_PROPOSALS_KEY } from '@/stores/saved-proposals-store';
import { useProposalStore } from '@/stores/proposal-store';
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
  useProposalStore.getState().reset();
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useDrawingStore.setState(useDrawingStore.getInitialState());
  useMapStore.setState(useMapStore.getInitialState());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('reloads browser drafts into map overlays and reopens a saved draft from the accessible list without deleting it', async () => {
  const proposal = ready();
  useSavedProposalsStore.getState().saveProposal(proposal);
  useProposalStore.getState().reset();
  useSavedProposalsStore.setState({ proposals: {} });
  const map = new MapFake();
  render(<><EditorHUD /><SavedProposalsLayer map={map.asMap()} /></>);
  expect(map.sources.size).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'Saved drafts (1)' }));
  expect(screen.getByRole('dialog', { name: 'Saved drafts' })).toHaveTextContent('Private to this browser');
  fireEvent.click(screen.getByRole('button', { name: /Reopen Broadway/ }));
  expect(await screen.findByRole('button', { name: 'Save draft' })).toBeInTheDocument();
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'propose', designLocation: location });
  expect(useMapStore.getState()).toMatchObject({ center: { lat: location.lat, lng: location.lng }, zoom: 17 });
  expect(useSavedProposalsStore.getState().getProposal(proposal.id)).toEqual(proposal);
  expect(useProposalStore.getState().getProposal()?.id).toBe(proposal.id);
  expect(map.sources.size).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(Object.keys(useSavedProposalsStore.getState().proposals)).toEqual([proposal.id]);
  fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
  expect(screen.getByRole('button', { name: 'Saved drafts (1)' })).toBeInTheDocument();
  expect(map.sources.size).toBe(2);
});

it('explains an empty collection, resumes incomplete work, and hides the launcher while drawing', () => {
  const view = render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved drafts (0)' }));
  expect(screen.getByText(/No saved drafts yet/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
  act(() => useProposalStore.getState().initProposal('', location));
  fireEvent.click(screen.getByRole('button', { name: 'Saved drafts (0)' }));
  expect(screen.getByText(/Unfinished work stays here until you reload or start another street/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resume current proposal' }));
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  act(() => useDrawingStore.getState().setActiveTool('road'));
  expect(view.container).toBeEmptyDOMElement();
});

it('offers a retry when browser drafts cannot be read and lists valid records after recovery', () => {
  const proposal = ready();
  proposal.streetName = '';
  useSavedProposalsStore.getState().saveProposal(proposal);
  useProposalStore.getState().reset();
  const raw = localStorage.getItem(SAVED_PROPOSALS_KEY)!;
  localStorage.setItem(SAVED_PROPOSALS_KEY, '{');
  useSavedProposalsStore.getState().loadProposals();
  render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: /Saved drafts — storage unavailable/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not be read');
  localStorage.setItem(SAVED_PROPOSALS_KEY, raw);
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading drafts' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Reopen Street proposal/ })).toBeInTheDocument();
});


it('lists the most recently updated browser draft first', () => {
  const older = ready();
  const newer = { ...older, id: 'newer-draft', streetName: 'Colfax', metadata: { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2099-01-01T00:00:00Z' } };
  useSavedProposalsStore.getState().saveProposal(older);
  useSavedProposalsStore.getState().saveProposal(newer);
  useProposalStore.getState().reset();
  render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved drafts (2)' }));
  expect(screen.getAllByRole('button', { name: /^Reopen/ }).map((button) => button.textContent)).toEqual([
    expect.stringContaining('Reopen Colfax'), expect.stringContaining('Reopen Broadway'),
  ]);
});


it.each(['list', 'map'] as const)('protects unfinished work when reopening another draft from the %s', async (entrypoint) => {
  const saved = ready();
  useSavedProposalsStore.getState().saveProposal(saved);
  useProposalStore.getState().initProposal('Unfinished Colfax', location);
  useProposalStore.getState().selectPreset(BEFORE_PRESETS[1]);
  const unfinished = useProposalStore.getState().beforeStreet;
  const map = new MapFake();
  Object.assign(map, { queryRenderedFeatures: () => [{ layer: { id: `saved-${saved.id}-element-fill-0` } }] });
  render(entrypoint === 'list' ? <SavedDrafts /> : <SavedProposalsLayer map={map.asMap()} />);
  const open = async () => {
    if (entrypoint === 'list') {
      fireEvent.click(screen.getByRole('button', { name: 'Saved drafts (1)' }));
      fireEvent.click(screen.getByRole('button', { name: /Reopen Broadway/ }));
    } else {
      await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
    }
  };
  await open();
  expect(screen.getByRole('dialog', { name: 'Replace unsaved work?' })).toHaveTextContent('Unfinished Colfax');
  expect(useProposalStore.getState().beforeStreet).toEqual(unfinished);
  fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
  expect(useProposalStore.getState().streetName).toBe('Unfinished Colfax');
  expect(useWorkspaceStore.getState().mode).toBe('explore');
  await open();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(useProposalStore.getState().beforeStreet).toEqual(unfinished);
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes and open draft' }));
  expect(useProposalStore.getState().streetName).toBe('Broadway');
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useSavedProposalsStore.getState().getProposal(saved.id)).toEqual(saved);
});

it('protects edited completed work even when reopening its own older saved copy', () => {
  const saved = ready();
  useSavedProposalsStore.getState().saveProposal(saved);
  useProposalStore.setState({ streetName: 'Unsaved Broadway revision' });
  render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved drafts (1)' }));
  fireEvent.click(screen.getByRole('button', { name: /Reopen Broadway/ }));
  expect(screen.getByRole('dialog', { name: 'Replace unsaved work?' })).toHaveTextContent('Unsaved Broadway revision');
  fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
  expect(useProposalStore.getState().streetName).toBe('Unsaved Broadway revision');
});


it('describes unnamed drafts clearly when switching would discard unfinished work', () => {
  const saved = ready();
  saved.streetName = '';
  useSavedProposalsStore.getState().saveProposal(saved);
  useProposalStore.getState().initProposal('', location);
  render(<SavedDrafts />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved drafts (1)' }));
  fireEvent.click(screen.getByRole('button', { name: /Reopen Street proposal/ }));
  expect(screen.getByRole('dialog', { name: 'Replace unsaved work?' })).toHaveTextContent('Opening this saved draft will discard unsaved changes to your current proposal');
  fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
  expect(useProposalStore.getState().step).toBe('concern');
});
