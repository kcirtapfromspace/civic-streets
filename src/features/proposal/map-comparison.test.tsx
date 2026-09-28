import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { MapFake } from '@/features/map/__tests__/map-fake';
import { useProposalStore } from '@/stores/proposal-store';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { loadTemplates } from '@/lib/templates';
import { MapComparison } from './MapComparison';
import { MapOverlay } from './MapOverlay';

beforeEach(() => {
  localStorage.clear();
  useProposalStore.getState().reset();
  useStreetStore.setState(useStreetStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
});
afterEach(cleanup);
function ready() {
  const location = { lat: 39.74, lng: -104.99, address: 'Broadway' };
  const proposal = useProposalStore.getState();
  proposal.initProposal('Broadway', location);
  proposal.setRoadPath([location, { lat: 39.75, lng: -104.99 }], 0);
  proposal.selectPreset(BEFORE_PRESETS[0]);
  proposal.applyTransformation(loadTemplates()[0]);
  const work = useProposalStore.getState();
  useStreetStore.getState().setStreet(work.afterStreet!);
  useStreetStore.getState().setBeforeStreet(work.beforeStreet);
  useWorkspaceStore.getState().enterDesignMode(location, work.proposalId!);
  useWorkspaceStore.getState().setDockExpanded(false);
  return work;
}
it('changes the map and selected label together while the dock stays collapsed', () => {
  const work = ready();
  const map = new MapFake();
  render(<><MapOverlay map={map.asMap()} /><MapComparison className="comparison-placement" /></>);
  expect(screen.getByRole('region', { name: 'Map comparison' })).toHaveClass('comparison-placement');
  expect(screen.getByRole('button', { name: 'After' })).toHaveAttribute('aria-pressed', 'true');
  expect(map.sources.get('proposal-active-elements')!.data.features).toHaveLength(work.afterStreet!.elements.length);
  fireEvent.click(screen.getByRole('button', { name: 'Before' }));
  expect(screen.getByRole('button', { name: 'Before' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'After' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('status')).toHaveTextContent('Showing before · Approximate layout');
  expect(map.sources.get('proposal-active-elements')!.data.features).toHaveLength(work.beforeStreet!.elements.length);
  fireEvent.click(screen.getByRole('button', { name: 'Before' }));
  expect(useStreetStore.getState().showBeforeAfter).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'After' }));
  expect(screen.getByRole('status')).toHaveTextContent('Showing after · Approximate layout');
  expect(map.sources.get('proposal-active-elements')!.data.features).toHaveLength(work.afterStreet!.elements.length);
  expect(useWorkspaceStore.getState().dockExpanded).toBe(false);
});
it('reflects the dock toggle and disables an unrecorded before layout', () => {
  ready();
  render(<MapComparison />);
  act(() => useStreetStore.getState().toggleBeforeAfter());
  expect(screen.getByRole('button', { name: 'Before' })).toHaveAttribute('aria-pressed', 'true');
  act(() => useStreetStore.getState().setBeforeStreet(null));
  expect(screen.getByRole('button', { name: 'Before' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Before' })).toHaveAttribute('title', 'No before layout has been recorded');
  expect(screen.getByRole('button', { name: 'After' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Showing after');
});
it.each(['outside-editor', 'unlinked', 'different-draft', 'unplaced', 'no-street'] as const)('hides map comparison for %s work', (state) => {
  ready();
  if (state === 'outside-editor') useWorkspaceStore.getState().exitToExplore();
  else if (state === 'unlinked') useWorkspaceStore.setState({ designProposalId: null });
  else if (state === 'different-draft') useWorkspaceStore.setState({ designProposalId: 'different' });
  else if (state === 'unplaced') useProposalStore.setState({ roadPath: [] });
  else useStreetStore.setState({ currentStreet: null });
  render(<MapComparison />);
  expect(screen.queryByRole('region', { name: 'Map comparison' })).not.toBeInTheDocument();
});
