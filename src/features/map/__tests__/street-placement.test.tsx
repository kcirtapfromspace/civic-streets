import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StreetPlacement } from '../StreetPlacement';
import { MapFake, mouse } from './map-fake';
import { useMapStore } from '../map-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useWorkDraftsStore, WORK_DRAFTS_KEY } from '@/stores/work-drafts-store';
import { street } from '@/features/editor/__tests__/fixtures';

beforeEach(() => {
  localStorage.clear();
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  useProposalStore.setState(useProposalStore.getInitialState());
  useStreetStore.setState(useStreetStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useMapStore.setState(useMapStore.getInitialState());
  useProposalStore.getState().initConcern('Library block');
  useProposalStore.setState({ beforeStreet: street(), afterStreet: { ...street(), id: 'after' }, step: 'review' });
  useProposalStore.getState().setBriefContext({ concern: 'A difficult crossing', requestedNextStep: 'Discuss this option' });
  useWorkspaceStore.setState({ mode: 'place-street' });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('previews a manually marked path and saves the same draft with its context and original layout', async () => {
  const map = new MapFake();
  const id = useProposalStore.getState().proposalId!;
  const original = useProposalStore.getState().beforeStreet!;
  map.canvas.style.cursor = 'grab';
  const view = render(<StreetPlacement map={map.asMap()} error={null} />);
  expect(useMapStore.getState().zoom).toBe(17);
  expect(map.canvas.style.cursor).toBe('crosshair');
  expect(screen.getByRole('button', { name: 'Use this placement' })).toBeDisabled();
  await act(() => map.emit('click', mouse(39.74, -104.99)));
  expect(screen.getByRole('status')).toHaveTextContent('1 point marked');
  await act(() => map.emit('click', mouse(39.741, -104.99)));
  const preview = map.sources.get('street-placement-elements')!.data.features;
  expect(preview).toHaveLength(street().elements.length);
  expect(preview[0].geometry.type).toBe('Polygon');
  expect(map.sources.get('street-placement-highlight')!.data.features[0].geometry.coordinates).toEqual([[-104.99, 39.74], [-104.99, 39.741]]);
  // Placement is only a preview until confirmed.
  expect(useProposalStore.getState().roadPath).toEqual([]);
  fireEvent.change(screen.getByRole('textbox', { name: 'Location description' }), { target: { value: 'Grant Street, library block' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this placement' }));
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'design', designProposalId: id, showValidationPanel: false });
  expect(useProposalStore.getState()).toMatchObject({ proposalId: id, bearing: 0, showBeforeOnMap: false, location: { lat: 39.7405, lng: -104.99, address: 'Grant Street, library block' } });
  expect(useStreetStore.getState().beforeStreet?.elements).toEqual(original.elements);
  expect(useStreetStore.getState().currentStreet?.location).toEqual(useProposalStore.getState().location);
  const saved = JSON.parse(localStorage.getItem(WORK_DRAFTS_KEY)!);
  expect(saved.drafts).toHaveLength(1);
  expect(saved.drafts[0]).toMatchObject({ id, roadPath: [{ lat: 39.74, lng: -104.99 }, { lat: 39.741, lng: -104.99 }], briefContext: { concern: 'A difficult crossing', requestedNextStep: 'Discuss this option' } });
  view.unmount();
  expect(map.layers.size).toBe(0);
  expect(map.sources.size).toBe(0);
  expect(map.canvas.style.cursor).toBe('grab');
  expect(map.listeners.get('click')?.size).toBe(0);
});

it('supports center placement, rejects duplicate or invalid coordinates and can undo before cancelling', async () => {
  const map = new MapFake();
  const initial = useProposalStore.getState().getWork();
  render(<StreetPlacement map={map.asMap()} error={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add map center' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add map center' }));
  await act(() => map.emit('click', mouse(NaN, -104)));
  await act(() => map.emit('click', mouse(90, -104)));
  await act(() => map.emit('click', mouse(39, 190)));
  await act(() => map.emit('click', mouse(39, NaN)));
  expect(screen.getByRole('status')).toHaveTextContent('1 point marked');
  map.center = { lat: 39.701, lng: -104.9 };
  fireEvent.click(screen.getByRole('button', { name: 'Add map center' }));
  expect(screen.getByRole('status')).toHaveTextContent('Layout preview shown');
  fireEvent.click(screen.getByRole('button', { name: 'Undo point' }));
  expect(screen.getByRole('button', { name: 'Use this placement' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel placement' }));
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useProposalStore.getState().getWork()).toMatchObject({ ...initial, updatedAt: expect.any(String) });
});

it('keeps a failed save editable and retries without losing the centerline', async () => {
  const map = new MapFake();
  useProposalStore.setState({ beforeStreet: null });
  render(<StreetPlacement map={map.asMap()} error={null} />);
  await act(() => map.emit('click', mouse(39.74, -104.99)));
  await act(() => map.emit('click', mouse(39.74, -104.989)));
  fireEvent.change(screen.getByRole('textbox', { name: 'Location description' }), { target: { value: ' ' } });
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  fireEvent.click(screen.getByRole('button', { name: 'Use this placement' }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
  expect(useWorkspaceStore.getState().mode).toBe('place-street');
  expect(useProposalStore.getState().roadPath).toEqual([]);
  expect(useWorkDraftsStore.getState().pending).toEqual({});
  write.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Use this placement' }));
  expect(useWorkspaceStore.getState().mode).toBe('design');
  expect(useStreetStore.getState().beforeStreet).toBeNull();
  expect(useProposalStore.getState().bearing).toBeCloseTo(90, 2);
});

it('cancels a failed placement without persisting tentative geometry on a later retry', async () => {
  const map = new MapFake();
  render(<StreetPlacement map={map.asMap()} error={null} />);
  const original = useProposalStore.getState().getWork()!;
  await act(() => map.emit('click', mouse(39.74, -104.99)));
  await act(() => map.emit('click', mouse(39.741, -104.99)));
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  fireEvent.click(screen.getByRole('button', { name: 'Use this placement' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel placement' }));
  write.mockRestore();
  useWorkDraftsStore.getState().retry();
  expect(useProposalStore.getState().getWork()).toMatchObject({ ...original, updatedAt: expect.any(String) });
  expect(useWorkDraftsStore.getState().drafts[original.id].location).toBeNull();
});

it('explains loading and map failure, preserves prior placement on Escape, and centers on existing work', () => {
  const location = { lat: 40, lng: -105, address: 'Existing street' };
  useProposalStore.setState({ location, roadPath: [location, { lat: 40.001, lng: -105 }] });
  useMapStore.setState({ zoom: 19 });
  const view = render(<StreetPlacement map={null} error={null} />);
  expect(useMapStore.getState()).toMatchObject({ center: location, zoom: 19 });
  expect(screen.getByRole('status')).toHaveTextContent('Loading the map');
  expect(screen.getByRole('button', { name: 'Use this placement' })).toBeDisabled();
  view.rerender(<StreetPlacement map={null} error="Tiles unavailable" />);
  expect(screen.getByRole('alert')).toHaveTextContent('map is unavailable');
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(useWorkspaceStore.getState().mode).toBe('place-street');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useProposalStore.getState().location).toEqual(location);
  expect(useProposalStore.getState().roadPath).toHaveLength(2);
});

it('starts adjustments from the saved path, permits redrawing, and restores controls after a map recovery', () => {
  const points = [{ lat: 39.74, lng: -104.99 }, { lat: 39.741, lng: -104.99 }];
  useProposalStore.setState({ roadPath: points });
  const map = new MapFake();
  const view = render(<StreetPlacement map={map.asMap()} error="Temporary tile failure" />);
  expect(screen.getByRole('button', { name: 'Use this placement' })).toBeDisabled();
  view.rerender(<StreetPlacement map={map.asMap()} error={null} />);
  expect(screen.getByRole('status')).toHaveTextContent('2 points marked');
  expect(screen.getByRole('button', { name: 'Use this placement' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Redraw path' }));
  expect(screen.getByRole('status')).toHaveTextContent('0 points marked');
  expect(useProposalStore.getState().roadPath).toEqual(points);
});

it('redraws the placement on a loaded replacement style and cleans up failed previews', async () => {
  const map = new MapFake();
  map.styleLoaded = false;
  const view = render(<StreetPlacement map={map.asMap()} error={null} />);
  expect(map.sources.size).toBe(0);
  map.styleLoaded = true;
  await act(() => map.emit('style.load'));
  expect(map.sources.has('street-placement-points')).toBe(true);
  await act(() => map.emit('click', mouse(39.74, -104.99)));
  await act(() => map.emit('click', mouse(39.741, -104.99)));
  map.layers.clear(); map.sources.clear();
  await act(() => map.emit('style.load'));
  expect(map.sources.has('street-placement-elements')).toBe(true);
  vi.spyOn(map, 'addLayer').mockImplementationOnce(() => { throw new Error('Style reset'); });
  fireEvent.click(screen.getByRole('button', { name: 'Undo point' }));
  view.unmount();
  expect(map.sources.size).toBe(0);
});

it('cannot place a draft with no street layout', () => {
  useProposalStore.setState({ afterStreet: null });
  const map = new MapFake();
  render(<StreetPlacement map={map.asMap()} error={null} />);
  expect(map.sources.size).toBe(0);
  expect(screen.getByRole('button', { name: 'Use this placement' })).toBeDisabled();
});

it('keeps an existing storage problem visible and ignores a placement click queued after the draft closes', async () => {
  const map = new MapFake();
  useWorkDraftsStore.setState({ storageError: 'Earlier work could not be saved' });
  render(<StreetPlacement map={map.asMap()} error={null} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Earlier work could not be saved');
  await act(() => map.emit('click', mouse(39.74, -104.99)));
  await act(() => map.emit('click', mouse(39.741, -104.99)));
  const confirm = screen.getByRole('button', { name: 'Use this placement' });
  act(() => {
    useProposalStore.getState().reset();
    fireEvent.click(confirm);
  });
  expect(useProposalStore.getState().proposalId).toBeNull();
  expect(useWorkspaceStore.getState().mode).toBe('place-street');
});

it('cleans a partial polygon render so the next map style can recover', async () => {
  const map = new MapFake();
  useProposalStore.setState({ roadPath: [{ lat: 39.74, lng: -104.99 }, { lat: 39.741, lng: -104.99 }] });
  vi.spyOn(map, 'addLayer').mockImplementationOnce(() => { throw new Error('Style changed during drawing'); });
  render(<StreetPlacement map={map.asMap()} error={null} />);
  expect(map.sources.size).toBe(0);
  await act(() => map.emit('style.load'));
  expect(map.sources.get('street-placement-elements')!.data.features.length).toBeGreaterThan(0);
});
