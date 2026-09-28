vi.mock('@/lib/api/use-report-eligibility', () => ({ usePhotoRequirement: () => 'optional' }));
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MapView } from '../index';
import { useMapStore } from '../map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { MapFake } from './map-fake';
import type maplibregl from 'maplibre-gl';
const viewport = vi.hoisted(() => ({
  map: null as maplibregl.Map | null,
  isLoaded: false,
  error: null as string | null,
  programmatic: false,
}));
vi.mock('../useMapLibre', () => ({
  useMapLibre: () => viewport,
  get isProgrammaticMove() {
    return viewport.programmatic;
  },
}));
vi.mock('../MapControls', () => ({ MapControls: () => <div>Map controls</div> }));
vi.mock('../EarthView', () => ({ EarthView: () => null }));
vi.mock('../PinDesignFlow', () => ({ PinDesignFlow: () => null }));
vi.mock('../CommunityPinsLayer', () => ({ CommunityPinsLayer: () => null }));
vi.mock('../ServiceAreaLayer', () => ({ ServiceAreaLayer: () => null }));
vi.mock('../EditorHUD', () => ({ EditorHUD: () => null }));
vi.mock('@/features/proposal/MapOverlay', () => ({ MapOverlay: () => null }));
vi.mock('@/features/proposal/SavedProposalsLayer', () => ({ SavedProposalsLayer: () => null }));
vi.mock('@/features/drawing/DrawingLayer', () => ({ DrawingLayer: () => null }));
vi.mock('@/features/drawing/DrawingToolbar', () => ({ DrawingToolbar: () => null }));
vi.mock('@/features/drawing/DrawingActionCard', () => ({ DrawingActionCard: () => null }));
vi.mock('@/features/safety-data/CrashDataLayer', () => ({ CrashDataLayer: () => null }));
vi.mock('@/lib/api/use-hotspots', () => ({ useCreateHotspot: () => vi.fn(), useHotspotById: () => ({ hotspot: null, isLoading: false }) }));
beforeEach(() => {
  useMapStore.setState(useMapStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
  Object.assign(viewport, { map: null, isLoaded: false, error: null, programmatic: false });
});
afterEach(cleanup);
it('waits for map load before showing overlays and displays an initialization error', () => {
  const { rerender } = render(<MapView />);
  expect(screen.getByText('Loading map...')).toBeInTheDocument();
  expect(screen.queryByText('Map controls')).not.toBeInTheDocument();
  viewport.isLoaded = true;
  viewport.map = new MapFake().asMap();
  rerender(<MapView />);
  expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
  expect(screen.getByText('Map controls')).toBeInTheDocument();
  viewport.error = 'WebGL is unavailable';
  rerender(<MapView />);
  expect(screen.getByRole('heading', { name: 'The map is unavailable' })).toBeInTheDocument();
  expect(screen.getByText('WebGL is unavailable')).toBeInTheDocument();
  expect(screen.getByText('Map controls')).toBeInTheDocument();
});
it('writes user movements to the store, ignores programmatic moves, and removes listeners', async () => {
  const map = new MapFake();
  viewport.map = map.asMap();
  viewport.isLoaded = true;
  const { unmount } = render(<MapView />);
  await act(() => map.emit('movestart', {}));
  await act(() => map.emit('movestart', { originalEvent: new Event('pointerdown') }));
  expect(useMapStore.getState().initialLocationStatus).toBe('skipped');
  map.center = { lat: 40, lng: -105 };
  map.zoom = 17;
  await act(() => map.emit('moveend'));
  expect(useMapStore.getState()).toMatchObject({ center: { lat: 40, lng: -105 }, zoom: 17 });
  viewport.programmatic = true;
  map.center = { lat: 1, lng: 2 };
  map.zoom = 4;
  await act(() => map.emit('moveend'));
  expect(useMapStore.getState().zoom).toBe(17);
  act(() => useMapStore.getState().openContextMenu({ lat: 40, lng: -105, x: 1, y: 2 }));
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(useMapStore.getState().contextMenuPosition).not.toBeNull();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useMapStore.getState().contextMenuPosition).toBeNull();
  unmount();
  expect(map.listeners.get('moveend')?.size).toBe(0);
  expect(map.listeners.get('movestart')?.size).toBe(0);
});
it('allows dismissing an unsent report without writing to the backend', () => {
  useMapStore.getState().openReportForm({ lat: 39.7, lng: -104.9, address: 'Broadway, Denver' });
  render(<MapView />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(useMapStore.getState().reportFormOpen).toBe(false);
});

it('offers a text location during loading and can dismiss or reopen the map failure recovery', () => {
  const view = render(<MapView />);
  fireEvent.click(screen.getByRole('button', { name: 'Describe a location instead' }));
  expect(screen.getByRole('textbox', { name: 'Location description' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Return to workspace' }));
  expect(screen.getByText('Loading map...')).toBeInTheDocument();
  viewport.error = 'Map tiles unavailable';
  view.rerender(<MapView />);
  fireEvent.click(screen.getByRole('button', { name: 'Return to workspace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Map unavailable · Describe a location' }));
  expect(screen.getByRole('heading', { name: 'The map is unavailable' })).toBeInTheDocument();
});

it('shows placement recovery even when the map has not loaded', () => {
  useWorkspaceStore.setState({ mode: 'place-street' });
  viewport.error = 'WebGL unavailable';
  render(<MapView />);
  expect(screen.getByRole('region', { name: 'Place street on map' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('map is unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel placement' }));
  expect(useWorkspaceStore.getState().mode).toBe('propose');
});

it('mounts the interactive placement controls once the map is available', () => {
  useWorkspaceStore.setState({ mode: 'place-street' });
  viewport.map = new MapFake().asMap();
  viewport.isLoaded = true;
  render(<MapView />);
  expect(screen.getByRole('button', { name: 'Add map center' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Add map center' }));
  expect(screen.getByRole('status')).toHaveTextContent('1 point marked');
});
