import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { EditorHUD } from '../EditorHUD';
import { useMapStore } from '../map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStreetStore } from '@/stores/street-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { loadTemplates } from '@/lib/templates';
const validation = vi.hoisted(() => ({ validate: vi.fn(), load: vi.fn() }));
vi.mock('@/lib/standards', () => ({
  validateStreet: validation.validate,
  loadStandards: validation.load,
}));
vi.mock('@/features/editor/EditorDock', () => ({ EditorDock: () => <div>Editor dock</div> }));
vi.mock('@/features/editor/EditorSidePanel', () => ({
  EditorSidePanel: ({
    title,
    visible,
    onClose,
    children,
  }: {
    title: string;
    visible: boolean;
    onClose: () => void;
    children: ReactNode;
  }) =>
    visible ? (
      <section aria-label={title}>
        <button onClick={onClose}>Close {title}</button>
        {children}
      </section>
    ) : null,
}));
vi.mock('@/features/editor/CompactNewStreetForm', () => ({
  CompactNewStreetForm: () => <div>Configure street</div>,
}));
vi.mock('@/features/editor/ElementList', () => ({ ElementList: () => <div>Element list</div> }));
vi.mock('@/features/editor/ElementProperties', () => ({
  ElementProperties: () => <div>Properties</div>,
}));
vi.mock('@/features/editor/ValidationPanel', () => ({
  ValidationPanel: () => <div>Validation results</div>,
}));
vi.mock('@/features/gallery', () => ({ TemplateGalleryModal: () => <div>Templates</div> }));
vi.mock('@/features/proposal/ProposalFlow', () => ({
  ProposalFlow: () => <div>Propose street</div>,
}));
vi.mock('@/features/intersection/IntersectionFlow', () => ({
  IntersectionFlow: () => <div>Propose intersection</div>,
}));
const location = { lat: 39.7, lng: -104.9, address: 'Broadway' };
beforeEach(() => {
  localStorage.clear();
  useMapStore.setState(useMapStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useStreetStore.setState(useStreetStore.getInitialState());
  useProposalStore.setState(useProposalStore.getInitialState());
  useIntersectionStore.setState(useIntersectionStore.getInitialState());
  useSavedProposalsStore.setState(useSavedProposalsStore.getInitialState());
  useSafetyDataStore.setState(useSafetyDataStore.getInitialState());
  validation.validate.mockReset().mockReturnValue([]);
  validation.load.mockReset().mockReturnValue({});
});

it('leaves placement Escape handling to the placement panel and suppresses competing location actions', () => {
  useWorkspaceStore.setState({ mode: 'place-street' });
  render(<EditorHUD />);
  expect(useMapStore.getState().lockedToLocation).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useWorkspaceStore.getState().mode).toBe('place-street');
});
afterEach(cleanup);
it('zooms to configuration and design, validates changes, and reopens hidden editor panels', async () => {
  render(<EditorHUD />);
  expect(screen.queryByText('Configure street')).not.toBeInTheDocument();
  act(() => useWorkspaceStore.getState().enterConfigureMode(location));
  expect(await screen.findByText('Configure street')).toBeInTheDocument();
  expect(useMapStore.getState()).toMatchObject({
    center: { lat: 39.7, lng: -104.9 },
    zoom: 18,
    lockedToLocation: false,
  });
  act(() => useWorkspaceStore.getState().enterDesignMode());
  expect(screen.queryByText('Editor dock')).not.toBeInTheDocument();
  act(() => useStreetStore.getState().createNewStreet('Broadway', 60, 'local', 'two-way'));
  expect(await screen.findByText('Editor dock')).toBeInTheDocument();
  await waitFor(() => expect(validation.validate).toHaveBeenCalled());
  expect(useMapStore.getState().lockedToLocation).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Close Elements' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close Validation' }));
  expect(screen.queryByText('Element list')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Elements' }));
  fireEvent.click(screen.getByRole('button', { name: 'Validation' }));
  expect(screen.getByText('Element list')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(useWorkspaceStore.getState().mode).toBe('design');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useWorkspaceStore.getState().mode).toBe('explore');
  expect(useMapStore.getState().lockedToLocation).toBe(false);
});
it('saves a proposal on Escape, enables safety data, and resets intersection workflows', async () => {
  useStreetStore.getState().createNewStreet('Broadway', 60, 'local', 'two-way');
  useProposalStore.getState().initProposal('Broadway', location);
  useProposalStore.setState({
    beforeStreet: useStreetStore.getState().currentStreet,
    afterStreet: useStreetStore.getState().currentStreet,
    beforePresetId: 'local-road',
    selectedTemplateId: 'safer-crossing',
  });
  useWorkspaceStore.getState().enterProposeMode(location);
  render(<EditorHUD />);
  expect(await screen.findByText('Propose street')).toBeInTheDocument();
  expect(useMapStore.getState().zoom).toBe(17);
  expect(useSafetyDataStore.getState().enabled).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(Object.keys(useSavedProposalsStore.getState().proposals)).toHaveLength(1);
  expect(useProposalStore.getState().streetName).toBe('');
  act(() => useWorkspaceStore.getState().enterProposeMode(location));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(Object.keys(useSavedProposalsStore.getState().proposals)).toHaveLength(1);
  act(() => {
    useIntersectionStore.getState().initIntersection('Crossing', location, location);
    useWorkspaceStore.getState().enterIntersectionMode(location);
  });
  expect(await screen.findByText('Propose intersection')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useWorkspaceStore.getState().mode).toBe('explore');
  expect(useIntersectionStore.getState().intersectionName).toBe('');
});
it('keeps the editor available if the standards engine fails', async () => {
  validation.load.mockImplementationOnce(() => {
    throw new Error('standards unavailable');
  });
  useStreetStore.getState().createNewStreet('Broadway', 60, 'local', 'two-way');
  useWorkspaceStore.getState().enterDesignMode(location);
  render(<EditorHUD />);
  expect(await screen.findByText('Editor dock')).toBeInTheDocument();
  await waitFor(() => expect(validation.load).toHaveBeenCalled());
  expect(useStreetStore.getState().validationResults).toEqual([]);
  expect(useStreetStore.getState().validationStatus).toBe('error');
});

it('keeps work open after an Escape save failure and protects unsaved changes on reload', async () => {
  useStreetStore.getState().createNewStreet('Broadway', 60, 'local', 'two-way');
  useProposalStore.getState().initProposal('Broadway', location);
  useProposalStore.setState({
    beforeStreet: useStreetStore.getState().currentStreet,
    afterStreet: useStreetStore.getState().currentStreet,
    beforePresetId: 'local-road', selectedTemplateId: 'safer-crossing',
  });
  useWorkspaceStore.getState().enterProposeMode(location);
  render(<EditorHUD />);
  const unsaved = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unsaved);
  expect(unsaved.defaultPrevented).toBe(false);
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  act(() => useProposalStore.getState().setBriefContext({ concern: 'New notes while storage is full' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
  const failed = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(failed);
  expect(failed.defaultPrevented).toBe(true);
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useProposalStore.getState().afterStreet).not.toBeNull();
  blocked.mockRestore();
  act(() => { useProposalStore.getState().saveWork(); useSavedProposalsStore.getState().saveProposal(useProposalStore.getState().getProposal()!); });
  const saved = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(saved);
  expect(saved.defaultPrevented).toBe(false);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useWorkspaceStore.getState().mode).toBe('explore');
  const empty = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(empty);
  expect(empty.defaultPrevented).toBe(false);
  act(() => useProposalStore.getState().initProposal('Unfinished', location));
  const incomplete = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(incomplete);
  expect(incomplete.defaultPrevented).toBe(false);
});


it('returns detailed edits to the same draft for saving without replacing its original street', async () => {
  useStreetStore.getState().createNewStreet('Broadway', 60, 'local', 'two-way');
  const before = useStreetStore.getState().currentStreet!;
  useProposalStore.getState().initProposal('Broadway', location);
  useProposalStore.getState().setBriefContext({ concern: 'Narrow walking space', desiredOutcome: 'More room to pass', requestedNextStep: 'Discuss at the next neighborhood meeting' });
  useProposalStore.setState({ beforeStreet: before, afterStreet: before, beforePresetId: 'local-road', selectedTemplateId: 'safer-crossing' });
  useWorkspaceStore.getState().enterDesignMode(location, useProposalStore.getState().proposalId!);
  render(<EditorHUD />);
  expect(await screen.findByRole('button', { name: 'Review draft' })).toBeInTheDocument();
  act(() => useStreetStore.getState().updateStreetName('Broadway revised'));
  expect(useProposalStore.getState().afterStreet?.name).toBe('Broadway revised');
  expect(useProposalStore.getState().beforeStreet?.name).toBe('Broadway');
  fireEvent.click(screen.getByRole('button', { name: 'Review draft' }));
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useProposalStore.getState().getProposal()?.streetName).toBe('Broadway revised');
  expect(useProposalStore.getState().getProposal()?.briefContext).toMatchObject({
    concern: 'Narrow walking space', desiredOutcome: 'More room to pass',
    requestedNextStep: 'Discuss at the next neighborhood meeting',
  });
});

it('keeps a linked proposal and its original evidence when a replacement template creates a new street identity', async () => {
  useStreetStore.getState().createNewStreet('Broadway', 60, 'local', 'two-way', location);
  const before = useStreetStore.getState().currentStreet!;
  const proposal = useProposalStore.getState();
  proposal.initProposal('Broadway', location, { id: 'observed-1', title: 'Narrow sidewalk', description: 'Hard to pass here', photoUrls: ['https://example.org/photo.jpg'], ...location, createdAt: 1000, source: 'community' });
  proposal.setBriefContext({ desiredOutcome: 'Room to pass', dimensionBasis: 'measured', dimensionSource: 'Tape measure' });
  useProposalStore.setState({ beforeStreet: before, afterStreet: before, beforePresetId: 'local-road', selectedTemplateId: 'safer-crossing' });
  const originalContext = useProposalStore.getState().briefContext;
  const proposalId = useProposalStore.getState().proposalId!;
  useWorkspaceStore.getState().enterDesignMode(location, proposalId);
  render(<EditorHUD />);
  expect(await screen.findByRole('button', { name: 'Review draft' })).toBeInTheDocument();
  act(() => useStreetStore.getState().updateElement(before.elements[0].id, { width: 8 }));
  const modifiedBeforeTemplate = useStreetStore.getState().currentStreet!;
  act(() => useStreetStore.getState().applyTemplate(loadTemplates()[0], 60));
  const replacement = useStreetStore.getState().currentStreet!;
  expect(replacement.id).not.toBe(before.id);
  expect(useProposalStore.getState()).toMatchObject({ proposalId, afterStreet: { id: replacement.id, location }, beforeStreet: before, briefContext: originalContext });
  expect(useStreetStore.getState().beforeStreet).toEqual(before);
  expect(useStreetStore.getState().beforeStreet).not.toEqual(modifiedBeforeTemplate);
  fireEvent.click(screen.getByRole('button', { name: 'Review draft' }));
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'propose', designProposalId: null });
  expect(proposal.getProposal()?.afterStreet.id).toBe(replacement.id);
  expect(proposal.getProposal()?.briefContext?.observation?.photoUrls).toEqual(['https://example.org/photo.jpg']);
});

it('does not attach a standalone editor or an obsolete association to a draft with a matching street', async () => {
  useStreetStore.getState().createNewStreet('Broadway', 60, 'local', 'two-way');
  const before = useStreetStore.getState().currentStreet!;
  useProposalStore.getState().initProposal('Broadway', location);
  useProposalStore.setState({ beforeStreet: before, afterStreet: before });
  useWorkspaceStore.getState().enterDesignMode(location);
  render(<EditorHUD />);
  expect(await screen.findByText('Editor dock')).toBeInTheDocument();
  act(() => useStreetStore.getState().updateStreetName('Standalone edit'));
  expect(screen.queryByRole('button', { name: 'Review draft' })).not.toBeInTheDocument();
  expect(useProposalStore.getState().streetName).toBe('Broadway');
  act(() => useWorkspaceStore.getState().enterDesignMode(location, 'old-proposal-id'));
  act(() => useStreetStore.getState().updateStreetName('Other draft edit'));
  expect(useProposalStore.getState().streetName).toBe('Broadway');
});

it('does not discard an intersection through Escape when browser storage fails', async () => {
  useIntersectionStore.getState().initIntersection('Library crossing', location, location);
  useWorkspaceStore.getState().enterIntersectionMode(location);
  render(<EditorHUD />);
  await screen.findByText('Propose intersection');
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  fireEvent.keyDown(window, {key:'Escape'});
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
  expect(useIntersectionStore.getState().intersectionName).toBe('Library crossing');
  expect(useWorkspaceStore.getState().mode).toBe('propose-intersection');
  blocked.mockRestore();
  fireEvent.keyDown(window, {key:'Escape'});
  expect(useWorkspaceStore.getState().mode).toBe('explore');
});
