import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapFake } from '@/features/map/__tests__/map-fake';
import { MapOverlay } from './MapOverlay';
import { SavedProposalsLayer } from './SavedProposalsLayer';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { loadTemplates } from '@/lib/templates';
import {
  cleanupMapLayers,
  cleanupMapSource,
  renderStreetOnMap,
} from './utils/render-street-layers';
import { computeElementOffsets, offsetPolyline } from './utils/offset-polyline';
import { snapToRoad } from './utils/road-snap';
import type { ElementType } from '@/lib/types';

const path = [
  { lat: 39.74, lng: -104.99 },
  { lat: 39.741, lng: -104.99 },
  { lat: 39.742, lng: -104.989 },
];
function ready() {
  const store = useProposalStore.getState();
  store.initProposal('Main Street', { ...path[0], address: 'Main Street' });
  store.setRoadPath(path, 0);
  store.selectPreset(BEFORE_PRESETS[0]);
  store.applyTransformation(loadTemplates()[0]);
  return useProposalStore.getState().getProposal()!;
}
beforeEach(() => {
  useProposalStore.getState().reset();
  useWorkspaceStore.setState({ mode: 'explore' });
  useSavedProposalsStore.setState({ proposals: {} });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('street geometry rendering', () => {
  it('offsets straight roads to their correct side, smoothly handles bends and centers element widths', () => {
    expect(offsetPolyline([], 5)).toEqual([]);
    const one = path.slice(0, 1);
    expect(offsetPolyline(one, 5)).toBe(one);
    const right = offsetPolyline(path, 10);
    const left = offsetPolyline(path, -10);
    expect(right[0].lng).toBeGreaterThan(path[0].lng);
    expect(left[0].lng).toBeLessThan(path[0].lng);
    expect(right.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true);
    expect(offsetPolyline(path, 0)).toEqual(path);
    expect(computeElementOffsets([{ width: 6 }, { width: 10 }, { width: 6 }], 22)).toEqual([
      { centerOffset: -8, width: 6 },
      { centerOffset: 0, width: 10 },
      { centerOffset: 8, width: 6 },
    ]);
  });

  it('renders closed world-width lane polygons and permits idempotent removal of its own map resources', () => {
    const map = new MapFake();
    const proposal = ready();
    expect(renderStreetOnMap(map.asMap(), 'short', [], proposal.afterStreet)).toEqual({
      sourceIds: [],
      layerIds: [],
    });
    const street = {
      ...proposal.afterStreet,
      elements: [
        ...proposal.afterStreet.elements,
        {
          ...proposal.afterStreet.elements[0],
          id: 'legacy',
          type: 'legacy-unknown' as ElementType,
        },
      ],
    };
    const result = renderStreetOnMap(map.asMap(), 'test', path, street, { opacity: 0.5 });
    expect(result.sourceIds).toEqual(['test-highlight', 'test-elements']);
    const features = map.sources.get('test-elements')!.data.features;
    expect(features).toHaveLength(proposal.afterStreet.elements.length);
    for (const feature of features) {
      expect(feature.geometry.type).toBe('Polygon');
      const ring = (feature.geometry.coordinates as number[][][])[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      expect(ring.length).toBe(path.length * 2 + 1);
    }
    expect(map.layers.get('test-element-fill-0')!.paint['fill-opacity']).toBe(0.5);
    expect(map.sources.get('test-highlight')!.data.features[0].geometry.coordinates).toEqual(
      path.map((p) => [p.lng, p.lat]),
    );
    for (let repeat = 0; repeat < 2; repeat++) {
      cleanupMapLayers(map.asMap(), result.layerIds);
      for (const source of result.sourceIds) cleanupMapSource(map.asMap(), source);
    }
    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);
  });
});

describe('active and saved proposal map lifecycle', () => {
  it('renders selected before/after streets only in proposal mode and clears stale layers on state changes', async () => {
    const map = new MapFake();
    const proposal = ready();
    const view = render(<MapOverlay map={null} />);
    view.rerender(<MapOverlay map={map.asMap()} />);
    expect(map.sources.size).toBe(0);
    act(() => useWorkspaceStore.setState({ mode: 'propose' }));
    expect(map.sources.get('proposal-active-elements')!.data.features).toHaveLength(
      proposal.afterStreet.elements.length,
    );
    act(() => useProposalStore.setState({ showBeforeOnMap: true }));
    expect(map.sources.get('proposal-active-elements')!.data.features).toHaveLength(
      proposal.beforeStreet.elements.length,
    );
    act(() => useProposalStore.setState({ step: 'transform-selected', showBeforeOnMap: false }));
    expect(map.sources.get('proposal-active-elements')!.data.features).toHaveLength(
      proposal.afterStreet.elements.length,
    );
    act(() => useProposalStore.setState({ step: 'before-selected' }));
    expect(map.sources.get('proposal-active-elements')!.data.features).toHaveLength(
      proposal.beforeStreet.elements.length,
    );
    act(() => useProposalStore.setState({ beforeStreet: null }));
    expect(map.sources.size).toBe(0);
    act(() => useProposalStore.setState({ roadPath: [] }));
    expect(map.layers.size).toBe(0);
    view.unmount();
  });

  it.each(['active', 'saved'] as const)(
    'cancels delayed %s style callbacks on unmount and redraws after a style reset',
    async (kind) => {
      const map = new MapFake();
      const proposal = ready();
      map.styleLoaded = false;
      useWorkspaceStore.setState({ mode: 'propose' });
      useSavedProposalsStore.getState().saveProposal(proposal);
      const renderLayer = () =>
        render(
          kind === 'active' ? (
            <MapOverlay map={map.asMap()} />
          ) : (
            <SavedProposalsLayer map={map.asMap()} />
          ),
        );
      const first = renderLayer();
      expect(map.sources.size).toBe(0);
      first.unmount();
      map.styleLoaded = true;
      await act(async () => map.emit('styledata'));
      expect(map.sources.size).toBe(0);
      const second = renderLayer();
      expect(map.sources.size).toBe(2);
      map.sources.clear();
      map.layers.clear();
      await act(async () => map.emit('style.load'));
      expect(map.sources.size).toBe(2);
      second.unmount();
      expect(map.sources.size).toBe(0);
      expect(map.layers.size).toBe(0);
    },
  );

  it.each(['active', 'saved'] as const)(
    'defers %s drawing until style is ready and tolerates style failures',
    async (kind) => {
      const map = new MapFake();
      map.styleLoaded = false;
      const proposal = ready();
      useWorkspaceStore.setState({ mode: 'propose' });
      useSavedProposalsStore.getState().saveProposal(proposal);
      const view = render(
        kind === 'active' ? (
          <MapOverlay map={map.asMap()} />
        ) : (
          <SavedProposalsLayer map={map.asMap()} />
        ),
      );
      await act(async () => map.emit('styledata'));
      expect(map.sources.size).toBe(0);
      map.styleLoaded = true;
      map.addSource.mockImplementationOnce(() => {
        throw new Error('Style changed');
      });
      await act(async () => map.emit('style.load'));
      expect(map.sources.size).toBe(0);
      await act(async () => map.emit('style.load'));
      expect(map.sources.size).toBe(2);
      view.unmount();
    },
  );

  it('reopens a clicked saved proposal, ignores unrelated/stale feature IDs, and restores hover listeners/cursor on exit', async () => {
    const map = new MapFake();
    const queryRenderedFeatures = vi.fn();
    Object.assign(map, { queryRenderedFeatures });
    const proposal = ready();
    useSavedProposalsStore.getState().saveProposal(proposal);
    const view = render(<SavedProposalsLayer map={null} />);
    view.rerender(<SavedProposalsLayer map={map.asMap()} />);
    queryRenderedFeatures.mockReturnValue([{ layer: { id: 'unrelated-element-fill-0' } }]);
    await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
    expect(useSavedProposalsStore.getState().getProposal(proposal.id)).toBeTruthy();
    queryRenderedFeatures.mockReturnValue([{ layer: { id: 'saved-missing-element-fill-0' } }]);
    await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
    expect(useWorkspaceStore.getState().mode).toBe('explore');
    queryRenderedFeatures.mockReturnValue([
      { layer: { id: `saved-${proposal.id}-element-fill-0` } },
    ]);
    await act(async () => map.emit('mousemove', { point: { x: 0, y: 0 } }));
    expect(map.canvas.style.cursor).toBe('pointer');
    queryRenderedFeatures.mockReturnValue([]);
    await act(async () => map.emit('mousemove', { point: { x: 0, y: 0 } }));
    expect(map.canvas.style.cursor).toBe('');
    queryRenderedFeatures.mockReturnValue([
      { layer: { id: `saved-${proposal.id}-element-fill-0` } },
    ]);
    await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
    expect(useSavedProposalsStore.getState().getProposal(proposal.id)).toBeUndefined();
    expect(useProposalStore.getState()).toMatchObject({
      afterStreet: proposal.afterStreet,
      location: proposal.location,
      step: 'review',
    });
    expect(useWorkspaceStore.getState().mode).toBe('propose');
    expect(map.listeners.get('click')?.size).toBe(0);
    expect(map.listeners.get('mousemove')?.size).toBe(0);
    view.unmount();
  });
});

describe('road snapping provider boundary', () => {
  it('routes longitude/latitude endpoints, includes a midpoint for long trails, and returns route geometry', async () => {
    const network = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              geometry: {
                coordinates: [
                  [-104.99, 39.74],
                  [-104.98, 39.75],
                ],
              },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', network);
    const short = path.slice(0, 1);
    expect(await snapToRoad(short)).toBe(short);
    expect(network).not.toHaveBeenCalled();
    expect(await snapToRoad(path)).toEqual([
      { lng: -104.99, lat: 39.74 },
      { lng: -104.98, lat: 39.75 },
    ]);
    expect(network.mock.calls[0][0]).toContain(
      `${path[0].lng},${path[0].lat};${path[2].lng},${path[2].lat}`,
    );
    const long = Array.from({ length: 101 }, (_, i) => ({ lat: 39 + i / 1000, lng: -105 }));
    network.mockResolvedValueOnce(new Response(JSON.stringify({ routes: [] })));
    expect(await snapToRoad(long)).toBe(long);
    expect(network.mock.calls[1][0]).toContain('-105,39;-105,39.05;-105,39.1');
  });

  it.each(['http', 'network', 'malformed', 'missing', 'short-route'])(
    'preserves the drawn path after %s failure',
    async (failure) => {
      const network = vi.fn();
      vi.stubGlobal('fetch', network);
      if (failure === 'network') network.mockRejectedValue(new Error('Offline'));
      else if (failure === 'http') network.mockResolvedValue(new Response('', { status: 503 }));
      else if (failure === 'malformed') network.mockResolvedValue(new Response('{'));
      else
        network.mockResolvedValue(
          new Response(
            JSON.stringify(
              failure === 'missing'
                ? {}
                : { routes: [{ geometry: { coordinates: [[-105, 39]] } }] },
            ),
          ),
        );
      expect(await snapToRoad(path)).toBe(path);
    },
  );
});
