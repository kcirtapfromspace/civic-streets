import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type maplibregl from 'maplibre-gl';
import type { NormalizedCrash } from '@/lib/types/safety-data';
import { CrashDataLayer } from '../CrashDataLayer';
import { useSafetyDataStore } from '../safety-data-store';

const { popup } = vi.hoisted(() => ({
  popup: {
    setLngLat: vi.fn().mockReturnThis(),
    setDOMContent: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
  },
}));
vi.mock('maplibre-gl', () => ({
  default: {
    Popup: vi.fn(function () {
      return popup;
    }),
  },
}));
vi.mock('@/features/map/useStyleReload', () => ({ useStyleReload: () => 0 }));

const realFetchForBounds = useSafetyDataStore.getState().fetchForBounds;
const fetchForBounds = vi.fn();
const crash: NormalizedCrash = {
  id: 'denver-one',
  source: 'denver',
  lat: 39.74,
  lng: -104.99,
  date: '2026-02-10',
  modes: ['cyclist'],
  severity: 'unknown',
  fatalities: null,
  injuries: null,
  injuryCountScope: 'serious-only',
};

function makeMap(zoom = 13) {
  const sources = new Map<string, maplibregl.GeoJSONSourceSpecification>();
  const layers = new Map<string, maplibregl.LayerSpecification>();
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const map = {
    getZoom: vi.fn(() => zoom),
    getBounds: () => ({
      getSouth: () => 39.73,
      getWest: () => -105,
      getNorth: () => 39.75,
      getEast: () => -104.98,
    }),
    isStyleLoaded: vi.fn(() => true),
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: vi.fn((id: string, source: maplibregl.GeoJSONSourceSpecification) =>
      sources.set(id, source),
    ),
    addLayer: vi.fn((layer: maplibregl.LayerSpecification) => layers.set(layer.id, layer)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    on: vi.fn(
      (
        event: string,
        layerOrCallback: string | ((...args: unknown[]) => void),
        callback?: (...args: unknown[]) => void,
      ) => {
        const listener = callback ?? (layerOrCallback as (...args: unknown[]) => void);
        const eventListeners = listeners.get(event) ?? new Set();
        eventListeners.add(listener);
        listeners.set(event, eventListeners);
      },
    ),
    off: vi.fn(
      (
        event: string,
        layerOrCallback: string | ((...args: unknown[]) => void),
        callback?: (...args: unknown[]) => void,
      ) => {
        listeners.get(event)?.delete(callback ?? (layerOrCallback as (...args: unknown[]) => void));
      },
    ),
    once: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(callback);
      listeners.set(event, eventListeners);
    }),
    queryRenderedFeatures: vi.fn(),
  };
  return {
    map,
    sources,
    layers,
    instance: map as unknown as maplibregl.Map,
    emit: (event: string, value?: unknown) =>
      [...(listeners.get(event) ?? [])].forEach((callback) => callback(value)),
    data: () => [...sources.values()][0]?.data as GeoJSON.FeatureCollection,
    listenerCount: (event: string) => listeners.get(event)?.size ?? 0,
  };
}

describe('crash map layer behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    fetchForBounds.mockResolvedValue(undefined);
    useSafetyDataStore.getState().clearAll();
    useSafetyDataStore.setState({
      enabled: true,
      showHeatmap: true,
      showPoints: true,
      fetchForBounds,
      crashes: [crash],
      filters: {
        modes: new Set(['pedestrian', 'cyclist', 'motorist']),
        severities: new Set(['fatal', 'severe-injury', 'moderate-injury', 'minor', 'unknown']),
        dateRange: null,
      },
    });
  });
  afterEach(() => {
    cleanup();
    useSafetyDataStore.setState({ fetchForBounds: realFetchForBounds });
    useSafetyDataStore.getState().setEnabled(false);
    vi.useRealTimers();
  });

  it('debounces map movement, cancels a queued fetch when zooming out, and cleans up on unmount', () => {
    const view = makeMap();
    const { unmount } = render(<CrashDataLayer map={view.instance} />);
    act(() => {
      view.emit('moveend');
      view.emit('moveend');
      vi.advanceTimersByTime(499);
    });
    expect(fetchForBounds).not.toHaveBeenCalled();
    act(() => {
      view.map.getZoom.mockReturnValue(10);
      view.emit('moveend');
      vi.advanceTimersByTime(1000);
    });
    expect(fetchForBounds).not.toHaveBeenCalled();
    expect(useSafetyDataStore.getState().crashes).toEqual([]);
    act(() => {
      view.map.getZoom.mockReturnValue(13);
      view.emit('moveend');
      vi.advanceTimersByTime(500);
    });
    expect(fetchForBounds).toHaveBeenCalledTimes(1);
    expect(fetchForBounds).toHaveBeenCalledWith({
      south: 39.73,
      west: -105,
      north: 39.75,
      east: -104.98,
    });
    unmount();
    expect(view.listenerCount('moveend')).toBe(0);
    expect(view.listenerCount('click')).toBe(0);
    expect(view.sources.size).toBe(0);
  });

  it('shows unknown-severity records and applies mode, severity, and date filters to rendered map features', () => {
    useSafetyDataStore.setState({
      crashes: [
        crash,
        {
          ...crash,
          id: 'fatal-pedestrian',
          modes: ['pedestrian'],
          severity: 'fatal',
          fatalities: 1,
        },
        { ...crash, id: 'old-cyclist', date: '2020-01-01' },
      ],
    });
    const view = makeMap();
    render(<CrashDataLayer map={view.instance} />);
    expect(view.data().features).toHaveLength(3);
    act(() =>
      useSafetyDataStore.setState({
        filters: {
          modes: new Set(['cyclist']),
          severities: new Set(['unknown']),
          dateRange: { start: '2026-01-01', end: '2026-03-01' },
        },
      }),
    );
    expect(view.data().features).toHaveLength(1);
    expect(view.data().features[0].properties).toMatchObject({
      severityLabel: 'Other / unknown severity',
      sourceId: 'denver',
    });
    act(() => useSafetyDataStore.getState().toggleMode('cyclist'));
    expect(view.data().features).toEqual([]);
    act(() =>
      useSafetyDataStore.setState({
        filters: { modes: new Set(['cyclist']), severities: new Set(['fatal']), dateRange: null },
      }),
    );
    expect(view.data().features).toEqual([]);
  });

  it('keeps serious injury counts and UTC dates explicit in a Denver point popup', () => {
    useSafetyDataStore.setState({
      crashes: [{ ...crash, severity: 'severe-injury', injuries: 2, fatalities: 1 }],
    });
    const view = makeMap();
    render(<CrashDataLayer map={view.instance} />);
    view.map.queryRenderedFeatures.mockReturnValue(view.data().features);
    act(() => view.emit('click', { point: { x: 10, y: 10 } }));
    const content = popup.setDOMContent.mock.calls[0][0] as HTMLElement;
    expect(content.textContent).toContain('Date (UTC): 2026-02-10');
    expect(content.textContent).toContain('Source: Denver Traffic Accidents');
    expect(content.textContent).toContain('2 serious injuries');
    expect(content.textContent).toContain('Other injury counts are not supplied');
    expect(content.textContent).toContain('1 fatalities');
    expect(popup.setLngLat).toHaveBeenCalledWith([-104.99, 39.74]);
  });

  it('does not display a popup for empty map space or a layer that has been removed', () => {
    const view = makeMap();
    render(<CrashDataLayer map={view.instance} />);
    view.map.queryRenderedFeatures.mockReturnValue([]);
    act(() => view.emit('click', { point: { x: 10, y: 10 } }));
    expect(popup.addTo).not.toHaveBeenCalled();
    view.layers.clear();
    act(() => view.emit('click', { point: { x: 10, y: 10 } }));
    expect(view.map.queryRenderedFeatures).toHaveBeenCalledTimes(1);
  });

  it('waits for the map style before adding layers and obeys independent heatmap/point toggles', () => {
    const view = makeMap();
    view.map.isStyleLoaded.mockReturnValue(false);
    render(<CrashDataLayer map={view.instance} />);
    expect(view.sources.size).toBe(0);
    act(() => {
      view.map.isStyleLoaded.mockReturnValue(true);
      view.emit('styledata');
    });
    expect([...view.layers.values()].map((layer) => layer.type).sort()).toEqual([
      'circle',
      'heatmap',
    ]);
    act(() => useSafetyDataStore.getState().toggleHeatmap());
    expect([...view.layers.values()].map((layer) => layer.type)).toEqual(['circle']);
    act(() => useSafetyDataStore.getState().togglePoints());
    expect(view.layers.size).toBe(0);
    expect(view.listenerCount('click')).toBe(0);
  });

  it('does not install layers or request data while disabled or before a map is available', () => {
    const view = makeMap();
    useSafetyDataStore.getState().setEnabled(false);
    const { rerender } = render(<CrashDataLayer map={view.instance} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(view.sources.size).toBe(0);
    expect(fetchForBounds).not.toHaveBeenCalled();
    rerender(<CrashDataLayer map={null} />);
    expect(view.listenerCount('moveend')).toBe(0);
  });
});
