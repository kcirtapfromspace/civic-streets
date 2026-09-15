import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MapView } from '../index';
import { useMapStore } from '../map-store';
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
vi.mock('@/lib/api/use-hotspots', () => ({ useCreateHotspot: () => vi.fn() }));
beforeEach(() => {
  useMapStore.setState(useMapStore.getInitialState());
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
  expect(screen.getByRole('heading', { name: 'Map Error' })).toBeInTheDocument();
  expect(screen.getByText('WebGL is unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Map controls')).not.toBeInTheDocument();
});
it('writes user movements to the store, ignores programmatic moves, and removes listeners', async () => {
  const map = new MapFake();
  viewport.map = map.asMap();
  viewport.isLoaded = true;
  const { unmount } = render(<MapView />);
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
});
it('allows dismissing an unsent report without writing to the backend', () => {
  useMapStore.getState().openReportForm({ lat: 39.7, lng: -104.9, address: 'Broadway, Denver' });
  render(<MapView />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(useMapStore.getState().reportFormOpen).toBe(false);
});
