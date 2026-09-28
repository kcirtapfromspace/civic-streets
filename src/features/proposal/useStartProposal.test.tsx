import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
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
afterEach(cleanup);

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
