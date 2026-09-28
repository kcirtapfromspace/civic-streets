import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useStartProposal } from './useStartProposal';
import { useProposalStore } from '@/stores/proposal-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useMapStore } from '@/features/map/map-store';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { loadTemplates } from '@/lib/templates';

const location = { lat: 39.7, lng: -104.9, address: 'Broadway' };
function Launcher() {
  const { startProposal, confirmation } = useStartProposal();
  return <><button onClick={() => startProposal({ streetName: 'Broadway', location })}>Start</button>{confirmation}</>;
}
beforeEach(() => {
  localStorage.clear();
  useProposalStore.getState().reset();
  useSavedProposalsStore.setState(useSavedProposalsStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useMapStore.setState(useMapStore.getInitialState());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('starts a concern without requiring a navigation callback and permits replacing work already saved', () => {
  render(<Launcher />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(useProposalStore.getState()).toMatchObject({ step: 'concern', location });
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useMapStore.getState()).toMatchObject({ center: { lat: 39.7, lng: -104.9 }, zoom: 18 });
  const store = useProposalStore.getState();
  store.selectPreset(BEFORE_PRESETS[0]);
  store.applyTransformation(loadTemplates()[0]);
  const saved = store.getProposal()!;
  useSavedProposalsStore.getState().saveProposal(saved);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(useProposalStore.getState().proposalId).not.toBe(saved.id);
  expect(useSavedProposalsStore.getState().getProposal(saved.id)).toEqual(saved);
});


it.each(['Named street', ''])('protects failed browser edits for %s until an explicit replacement choice', (name) => {
  useProposalStore.getState().initProposal(name, location);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  useProposalStore.getState().setBriefContext({ concern: 'Keep this note' });
  render(<Launcher />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByRole('dialog')).toHaveTextContent(name || 'your current proposal');
  fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
  expect(useProposalStore.getState().briefContext.concern).toBe('Keep this note');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes and start proposal' }));
  expect(useProposalStore.getState()).toMatchObject({ streetName: 'Broadway', briefContext: { concern: '' } });
});
