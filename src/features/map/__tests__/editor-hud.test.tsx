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
});
