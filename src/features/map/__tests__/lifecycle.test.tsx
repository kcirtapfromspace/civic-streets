import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapFake } from './map-fake';
import { useStyleReload } from '../useStyleReload';
import { EarthView } from '../EarthView';
import { StreetViewPip } from '../StreetViewPip';
import { useMapStore } from '../map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { isProgrammaticMove, useMapLibre } from '../useMapLibre';

const maps = vi.hoisted(() => ({ instances: [] as MapFake[], fail: null as unknown }));
vi.mock('maplibre-gl', async () => {
  const { MapFake } = await import('./map-fake');
  return {
    default: {
      Map: class extends MapFake {
        constructor(options: { center: number[]; zoom: number }) {
          super();
          if (maps.fail) throw maps.fail;
          this.center = { lng: options.center[0], lat: options.center[1] };
          this.zoom = options.zoom;
          maps.instances.push(this);
        }
      },
      NavigationControl: class {},
      FullscreenControl: class {},
    },
  };
});
beforeEach(() => {
  maps.instances = [];
  maps.fail = null;
  useMapStore.setState(useMapStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('map lifetime and viewport', () => {
  const options = () => ({
    mapElement: document.createElement('div'),
    center: { lat: 39.7, lng: -104.9 },
    zoom: 12,
    mapType: 'roadmap' as const,
  });
  it('waits for a container and load event, then synchronizes meaningful viewport and style changes', async () => {
    vi.useFakeTimers();
    const initial = options();
    const { result, rerender, unmount } = renderHook(useMapLibre, {
      initialProps: {
        ...initial,
        mapElement: null as HTMLDivElement | null,
        mapType: 'roadmap' as 'roadmap' | 'satellite' | 'hybrid',
      },
    });
    expect(maps.instances).toHaveLength(0);
    rerender(initial);
    const map = maps.instances[0];
    expect(map.addControl).toHaveBeenCalledTimes(2);
    expect(result.current.isLoaded).toBe(false);
    await act(() => map.emit('load'));
    expect(result.current.map).toBe(map);
    expect(result.current.isLoaded).toBe(true);
    rerender({ ...initial, center: { lat: 39.70001, lng: -104.9 }, zoom: 12.01 });
    expect(map.jumpTo).not.toHaveBeenCalled();
    rerender({ ...initial, center: { lat: 40, lng: -105 }, zoom: 17, mapType: 'satellite' });
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [-105, 40], zoom: 17 });
    expect(isProgrammaticMove).toBe(true);
    act(() => vi.runOnlyPendingTimers());
    expect(isProgrammaticMove).toBe(false);
    expect(map.setStyle.mock.lastCall![0].sources.esri).toBeDefined();
    rerender({ ...initial, mapType: 'hybrid' });
    expect(map.setStyle.mock.lastCall![0].sources.labels).toBeDefined();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(() => map.emit('error', { error: new Error('tile unavailable') }));
    expect(log).toHaveBeenCalledWith('[MapLibre]', expect.any(Error));
    log.mockRestore();
    unmount();
    expect(map.remove).toHaveBeenCalledOnce();
  });
  it('releases and recreates maps for replacement containers and StrictMode remounts', async () => {
    const initial = options();
    const { rerender, unmount } = renderHook(useMapLibre, {
      initialProps: initial,
      wrapper: StrictMode,
    });
    expect(maps.instances.length).toBe(2);
    expect(maps.instances[0].remove).toHaveBeenCalledOnce();
    const active = maps.instances[1];
    await act(() => active.emit('load'));
    rerender({ ...initial, mapElement: document.createElement('div') });
    expect(active.remove).toHaveBeenCalledOnce();
    expect(maps.instances).toHaveLength(3);
    unmount();
    expect(maps.instances[2].remove).toHaveBeenCalledOnce();
  });
  it.each([new Error('WebGL disabled'), 'unexpected failure'])(
    'reports initialization failure safely',
    (failure) => {
      maps.fail = failure;
      const initial = options();
      const { result } = renderHook(() => useMapLibre(initial));
      expect(result.current.error).toBe(
        failure instanceof Error ? failure.message : 'Failed to load map',
      );
      expect(result.current.map).toBeNull();
    },
  );
  it('subscribes to the current map style only and unsubscribes on unmount', async () => {
    const first = new MapFake();
    const second = new MapFake();
    const { result, rerender, unmount } = renderHook(({ map }) => useStyleReload(map), {
      initialProps: { map: null as ReturnType<MapFake['asMap']> | null },
    });
    expect(result.current).toBe(0);
    rerender({ map: first.asMap() });
    await act(() => first.emit('style.load'));
    expect(result.current).toBe(1);
    rerender({ map: second.asMap() });
    await act(() => first.emit('style.load'));
    expect(result.current).toBe(1);
    await act(() => second.emit('style.load'));
    expect(result.current).toBe(2);
    unmount();
    expect(second.listeners.get('style.load')?.size).toBe(0);
  });
  it('tilts Earth view, preserves close zoom, and restores flat view', () => {
    const map = new MapFake();
    const { rerender } = render(<EarthView map={null} enabled={false} />);
    rerender(<EarthView map={map.asMap()} enabled={false} />);
    expect(map.easeTo).not.toHaveBeenCalled();
    rerender(<EarthView map={map.asMap()} enabled />);
    expect(map.easeTo).toHaveBeenLastCalledWith({ pitch: 60, bearing: 0, duration: 800 });
    expect(map.zoom).toBe(15);
    rerender(<EarthView map={map.asMap()} enabled={false} />);
    expect(map.easeTo).toHaveBeenLastCalledWith({ pitch: 0, bearing: 0, duration: 800 });
    map.zoom = 18;
    map.setZoom.mockClear();
    rerender(<EarthView map={map.asMap()} enabled />);
    expect(map.setZoom).not.toHaveBeenCalled();
  });
});

it('keeps map layer, viewport, and reporting controls reversible', () => {
  const s = useMapStore.getState();
  s.setCenter({ lat: 1, lng: 2 });
  s.setZoom(15);
  s.setMapType('satellite');
  s.toggle3D();
  expect(useMapStore.getState()).toMatchObject({ is3D: true, mapType: 'hybrid' });
  s.toggle3D();
  expect(useMapStore.getState()).toMatchObject({ is3D: false, mapType: 'roadmap' });
  s.toggleHotspots();
  s.toggleDesigns();
  s.toggleHeatmap();
  s.toggleServiceAreas();
  s.setActiveServiceAreaOrgId('org-1');
  s.setLockedToLocation(true);
  const location = { lat: 1, lng: 2, address: 'Denver' };
  s.setSelectedLocation(location);
  s.openContextMenu({ ...location, x: 10, y: 20 });
  s.openReportForm(location);
  expect(useMapStore.getState()).toMatchObject({
    center: { lat: 1, lng: 2 },
    zoom: 15,
    showHotspots: false,
    showDesigns: false,
    showHeatmap: true,
    showServiceAreas: true,
    activeServiceAreaOrgId: 'org-1',
    lockedToLocation: true,
    selectedLocation: location,
    reportFormLocation: location,
    reportFormOpen: true,
  });
  s.closeContextMenu();
  s.closeReportForm();
  expect(useMapStore.getState()).toMatchObject({
    contextMenuPosition: null,
    reportFormLocation: null,
    reportFormOpen: false,
  });
});
it('closes the Street View placeholder through the workspace store', () => {
  render(<StreetViewPip />);
  expect(screen.queryByText('Street View')).not.toBeInTheDocument();
  act(() => useWorkspaceStore.getState().toggleStreetViewPip());
  expect(screen.getByText('Street View not available with OpenStreetMap')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close Street View' }));
  expect(useWorkspaceStore.getState().showStreetViewPip).toBe(false);
});
