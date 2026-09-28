import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapFake } from '@/features/map/__tests__/map-fake';
import { useMapStore } from '@/features/map/map-store';
import { MapOverlay } from './MapOverlay';
import { SavedProposalsLayer } from './SavedProposalsLayer';
import { useProposalStore } from '@/stores/proposal-store';
import { useStreetStore } from '@/stores/street-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkDraftsStore, type StreetWork } from '@/stores/work-drafts-store';
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
  localStorage.clear();
  useProposalStore.getState().reset();
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useMapStore.setState(useMapStore.getInitialState());
  useStreetStore.setState(useStreetStore.getInitialState());
  useIntersectionStore.setState(useIntersectionStore.getInitialState());
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
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
      useWorkspaceStore.setState({ mode: kind === 'active' ? 'propose' : 'explore' });
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
      useWorkspaceStore.setState({ mode: kind === 'active' ? 'propose' : 'explore' });
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
    useProposalStore.getState().reset();
    useWorkDraftsStore.setState({ drafts: {} });
    useMapStore.getState().openContextMenu({ ...path[0], x: 10, y: 20 });
    const view = render(<SavedProposalsLayer map={null} />);
    view.rerender(<SavedProposalsLayer map={map.asMap()} />);
    queryRenderedFeatures.mockReturnValue([{ layer: { id: 'unrelated-element-fill-0' } }]);
    await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
    expect(useSavedProposalsStore.getState().getProposal(proposal.id)).toBeTruthy();
    expect(useMapStore.getState().contextMenuPosition).not.toBeNull();
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
    useMapStore.getState().openContextMenu({ ...path[0], x: 10, y: 20 });
    await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
    expect(useMapStore.getState().contextMenuPosition).toBeNull();
    expect(useSavedProposalsStore.getState().getProposal(proposal.id)).toEqual(proposal);
    expect(map.sources.size).toBe(0);
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

it('can leave a map with saved proposals after the parent map has already been removed', () => {
  const map = new MapFake();
  const proposal = ready();
  useProposalStore.getState().reset();
  useSavedProposalsStore.getState().saveProposal(proposal);
  const { unmount } = render(<SavedProposalsLayer map={map.asMap()} />);
  expect(map.layers.size).toBeGreaterThan(0);
  // MapLibre removes its style with the map; getLayer/getSource then throw.
  map.remove();
  map.getLayer.mockImplementation(() => { throw new Error('Map style removed'); });
  map.getSource.mockImplementation(() => { throw new Error('Map style removed'); });
  expect(unmount).not.toThrow();
});


describe('live detailed editor map rendering', () => {
  it('renders current editor widths and its before toggle instead of stale proposal snapshots', () => {
    const map = new MapFake();
    const proposal = ready();
    useWorkspaceStore.getState().enterDesignMode(proposal.location, proposal.id);
    useStreetStore.getState().setStreet(proposal.afterStreet);
    useStreetStore.getState().setBeforeStreet(proposal.beforeStreet);
    // Review's map toggle must not override the detailed editor's own toggle.
    useProposalStore.setState({ showBeforeOnMap: true });
    render(<MapOverlay map={map.asMap()} />);
    const afterGeometry = map.sources.get('proposal-active-elements')!.data.features;
    expect(afterGeometry).toHaveLength(proposal.afterStreet.elements.length);
    const element = proposal.afterStreet.elements[0];
    act(() => useStreetStore.getState().updateElement(element.id, { width: element.width + 3 }));
    const editedGeometry = map.sources.get('proposal-active-elements')!.data.features;
    expect(editedGeometry[0].geometry.coordinates).not.toEqual(afterGeometry[0].geometry.coordinates);
    expect(useProposalStore.getState().afterStreet).toEqual(proposal.afterStreet);
    act(() => useStreetStore.getState().toggleBeforeAfter());
    expect(map.sources.get('proposal-active-elements')!.data.features).toHaveLength(proposal.beforeStreet.elements.length);
    const beforeGeometry = map.sources.get('proposal-active-elements')!.data.features;
    act(() => useStreetStore.getState().toggleBeforeAfter());
    expect(map.sources.get('proposal-active-elements')!.data.features).toEqual(editedGeometry);
    expect(map.sources.get('proposal-active-elements')!.data.features).not.toEqual(beforeGeometry);
    // Match the dock fallback if a before snapshot is not available.
    act(() => {
      useStreetStore.getState().setBeforeStreet(null);
      useStreetStore.getState().toggleBeforeAfter();
    });
    expect(map.sources.get('proposal-active-elements')!.data.features).toEqual(editedGeometry);
  });

  it('requires the matching linked proposal and usable geometry, then removes active overlays on exit', () => {
    const map = new MapFake();
    const proposal = ready();
    useStreetStore.getState().setStreet(proposal.afterStreet);
    useWorkspaceStore.getState().enterDesignMode(proposal.location);
    render(<MapOverlay map={map.asMap()} />);
    expect(map.sources.size).toBe(0);
    act(() => useWorkspaceStore.getState().enterDesignMode(proposal.location, 'unrelated'));
    expect(map.sources.size).toBe(0);
    act(() => useWorkspaceStore.getState().enterDesignMode(proposal.location, proposal.id));
    expect(map.sources.size).toBe(2);
    act(() => useStreetStore.setState({ currentStreet: null }));
    expect(map.sources.size).toBe(0);
    act(() => useStreetStore.getState().setStreet(proposal.afterStreet));
    expect(map.sources.size).toBe(2);
    act(() => useProposalStore.setState({ roadPath: path.slice(0, 1) }));
    expect(map.sources.size).toBe(0);
    act(() => useProposalStore.setState({ roadPath: path }));
    expect(map.sources.size).toBe(2);
    act(() => useWorkspaceStore.getState().exitToExplore());
    expect(map.sources.size).toBe(0);
    expect(map.layers.size).toBe(0);
  });

  it('cancels stale delayed renders and restores the latest editor geometry after a style reload', async () => {
    const map = new MapFake();
    map.styleLoaded = false;
    const proposal = ready();
    useStreetStore.getState().setStreet(proposal.afterStreet);
    useWorkspaceStore.getState().enterDesignMode(proposal.location, proposal.id);
    const { unmount } = render(<MapOverlay map={map.asMap()} />);
    act(() => useStreetStore.getState().removeElement(proposal.afterStreet.elements[0].id));
    map.styleLoaded = true;
    await act(async () => map.emit('styledata'));
    const latest = map.sources.get('proposal-active-elements')!.data.features;
    expect(latest).toHaveLength(proposal.afterStreet.elements.length - 1);
    map.sources.clear();
    map.layers.clear();
    await act(async () => map.emit('style.load'));
    expect(map.sources.get('proposal-active-elements')!.data.features).toEqual(latest);
    map.styleLoaded = false;
    act(() => useStreetStore.getState().updateStreetName('Revised concept'));
    unmount();
    map.styleLoaded = true;
    await act(async () => map.emit('styledata'));
    expect(map.sources.size).toBe(0);
  });
});

describe('saved browser work map rendering', () => {
  function placedWork() {
    const proposal = ready();
    const work = useProposalStore.getState().getWork()!;
    useProposalStore.getState().reset();
    return { proposal, work };
  }
  it('prefers placed browser work over its legacy twin and preserves it across reload', () => {
    const map = new MapFake();
    const { proposal, work } = placedWork();
    useSavedProposalsStore.getState().saveProposal(proposal);
    const modified: StreetWork = { ...work, afterStreet: { ...work.afterStreet!, elements: work.afterStreet!.elements.slice(1) } };
    useWorkDraftsStore.getState().save(modified);
    useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
    useWorkDraftsStore.getState().load();
    const { unmount } = render(<SavedProposalsLayer map={map.asMap()} />);
    expect(map.sources.size).toBe(2);
    expect(map.sources.get(`saved-${work.id}-elements`)!.data.features).toHaveLength(modified.afterStreet!.elements.length);
    unmount();
    expect(map.sources.size).toBe(0);
  });

  it.each(['archived', 'unlocated', 'unplaced', 'no-design', 'intersection'] as const)('suppresses %s work, including an older legacy twin', (reason) => {
    const map = new MapFake();
    const { proposal, work } = placedWork();
    useSavedProposalsStore.getState().saveProposal(proposal);
    if (reason === 'intersection') {
      useIntersectionStore.getState().initIntersection('Crossing', null, null);
      useWorkDraftsStore.getState().save({ ...useIntersectionStore.getState().getWork()!, id: work.id });
    } else {
      const next = { ...work, ...(reason === 'archived' ? { archived: true } : reason === 'unlocated' ? { location: null } : reason === 'unplaced' ? { roadPath: [] } : { afterStreet: null }) };
      useWorkDraftsStore.getState().save(next);
    }
    render(<SavedProposalsLayer map={map.asMap()} />);
    expect(map.sources.size).toBe(0);
  });

  it('hides only the active saved copy while proposing, editing its linked design, or placing it', () => {
    const map = new MapFake();
    const { work } = placedWork();
    useWorkDraftsStore.getState().save(work);
    useWorkDraftsStore.getState().save({ ...work, id: 'another-draft' });
    useProposalStore.getState().loadWork(work);
    render(<SavedProposalsLayer map={map.asMap()} />);
    expect(map.sources.size).toBe(4);
    for (const mode of ['propose', 'design', 'place-street'] as const) {
      act(() => useWorkspaceStore.setState({ mode, designProposalId: work.id }));
      expect(map.sources.has(`saved-${work.id}-elements`)).toBe(false);
      expect(map.sources.has('saved-another-draft-elements')).toBe(true);
    }
    act(() => useWorkspaceStore.setState({ mode: 'design', designProposalId: 'unrelated' }));
    expect(map.sources.size).toBe(4);
    act(() => useWorkspaceStore.getState().exitToExplore());
    expect(map.sources.size).toBe(4);
  });

  it.each([true, false])('reopens placed work with its purpose intact and before geometry present=%s', async (hasBefore) => {
    const map = new MapFake();
    const { work } = placedWork();
    const current = { ...work, beforeStreet: hasBefore ? work.beforeStreet : null, beforePresetId: null, selectedTemplateId: null, briefContext: { ...work.briefContext, requestedNextStep: 'Walk this crossing with residents' } };
    useWorkDraftsStore.getState().save(current);
    Object.assign(map, { queryRenderedFeatures: vi.fn(() => [{ layer: { id: `saved-${work.id}-element-fill-0` } }]) });
    render(<SavedProposalsLayer map={map.asMap()} />);
    useMapStore.getState().openContextMenu({ ...path[0], x: 10, y: 20 });
    await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
    expect(useMapStore.getState().contextMenuPosition).toBeNull();
    expect(useProposalStore.getState()).toMatchObject({ proposalId: work.id, step: hasBefore ? 'review' : 'concern', beforePresetId: null, selectedTemplateId: null, showBeforeOnMap: false, briefContext: current.briefContext, roadPath: current.roadPath });
    expect(useWorkspaceStore.getState().mode).toBe('propose');
    expect(map.sources.size).toBe(0);
  });

  it.each(['street', 'intersection'] as const)('keeps unsaved current %s work when storage blocks switching', async (kind) => {
    const map = new MapFake();
    const { work } = placedWork();
    useWorkDraftsStore.getState().save(work);
    if (kind === 'street') useProposalStore.getState().initConcern('Current draft');
    else useIntersectionStore.getState().initIntersection('Current crossing', null, null);
    Object.assign(map, { queryRenderedFeatures: vi.fn(() => [{ layer: { id: `saved-${work.id}-element-fill-0` } }]) });
    render(<SavedProposalsLayer map={map.asMap()} />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await act(async () => map.emit('click', { point: { x: 0, y: 0 } }));
    expect(screen.getByRole('alert')).toHaveTextContent('current work could not be saved');
    expect(useWorkspaceStore.getState().mode).toBe('explore');
    expect(kind === 'street' ? useProposalStore.getState().streetName : useIntersectionStore.getState().intersectionName).toMatch(/Current/);
    fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

it.each(['active', 'saved'] as const)('cleans partially created %s resources when style changes interrupt drawing', async (kind) => {
  const map = new MapFake();
  ready();
  useWorkspaceStore.setState({ mode: kind === 'active' ? 'propose' : 'explore' });
  map.addLayer.mockImplementationOnce(() => { throw new Error('Style changed after creating the source'); });
  render(kind === 'active' ? <MapOverlay map={map.asMap()} /> : <SavedProposalsLayer map={map.asMap()} />);
  expect(map.sources.size).toBe(0);
  expect(map.layers.size).toBe(0);
  await act(async () => map.emit('style.load'));
  expect(map.sources.size).toBe(2);
});
