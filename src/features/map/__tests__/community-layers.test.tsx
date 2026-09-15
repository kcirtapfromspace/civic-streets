import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CommunityPinsLayer } from '../CommunityPinsLayer';
import { ServiceAreaLayer, type ServiceArea } from '../ServiceAreaLayer';
import { useMapStore } from '../map-store';
import { MOCK_DESIGNS, MOCK_HOTSPOTS } from '../mock-data';
import { MapFake } from './map-fake';
import type { HotspotPin, DesignPin } from '@/lib/types';
type MarkerFixture = {
  element: HTMLElement;
  coordinates: unknown;
  remove: ReturnType<typeof vi.fn>;
};
type PopupFixture = {
  content: HTMLElement;
  coordinates: unknown;
  remove: ReturnType<typeof vi.fn>;
};

const provider = vi.hoisted(() => ({
  hotspots: [] as HotspotPin[],
  designs: [] as DesignPin[],
  markers: [] as MarkerFixture[],
  popups: [] as PopupFixture[],
}));
vi.mock('@/lib/api/use-hotspots', () => ({
  useHotspotsByBounds: () => ({ hotspots: provider.hotspots }),
}));
vi.mock('@/lib/api/use-designs', () => ({
  useDesignsByBounds: () => ({ designs: provider.designs }),
}));
vi.mock('maplibre-gl', () => ({
  default: {
    Marker: class {
      element: HTMLElement;
      coordinates: unknown;
      remove = vi.fn();
      constructor(options: { element: HTMLElement }) {
        this.element = options.element;
        provider.markers.push(this);
      }
      setLngLat(point: unknown) {
        this.coordinates = point;
        return this;
      }
      addTo() {
        return this;
      }
    },
    Popup: class {
      content: HTMLElement = document.createElement('div');
      coordinates: unknown;
      remove = vi.fn();
      constructor() {
        provider.popups.push(this);
      }
      setLngLat(point: unknown) {
        this.coordinates = point;
        return this;
      }
      setDOMContent(content: HTMLElement) {
        this.content = content;
        return this;
      }
      addTo() {
        return this;
      }
    },
  },
}));
beforeEach(() => {
  useMapStore.setState(useMapStore.getInitialState());
  provider.markers = [];
  provider.popups = [];
  provider.hotspots = [MOCK_HOTSPOTS[0]];
  provider.designs = [
    { ...MOCK_DESIGNS[0], title: '<img src=x onerror=alert(1)>', prowagPass: true },
  ];
});
afterEach(cleanup);

it('places category and design pins, reuses a text-safe popup, and removes markers when layers turn off', () => {
  const map = new MapFake();
  const { rerender, unmount } = render(<CommunityPinsLayer map={null} />);
  expect(provider.markers).toHaveLength(0);
  rerender(<CommunityPinsLayer map={map.asMap()} />);
  expect(provider.markers).toHaveLength(2);
  const [hotspot, design] = provider.markers;
  expect(hotspot.coordinates).toEqual([MOCK_HOTSPOTS[0].lng, MOCK_HOTSPOTS[0].lat]);
  fireEvent.click(hotspot.element);
  expect(provider.popups[0].content.textContent).toContain(MOCK_HOTSPOTS[0].title);
  fireEvent.click(design.element);
  expect(provider.popups).toHaveLength(1);
  const content = provider.popups[0].content as HTMLElement;
  expect(content.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(content.querySelector('img')).toBeNull();
  expect(content.textContent).toContain('PROWAG Compliant');
  expect(content.querySelector('a')).toHaveAttribute('href', `/editor/${provider.designs[0].id}`);
  provider.designs = [{ ...provider.designs[0], prowagPass: false }];
  rerender(<CommunityPinsLayer map={map.asMap()} />);
  fireEvent.click(provider.markers[provider.markers.length - 1].element);
  expect(content).not.toBe(provider.popups[0].content);
  expect(provider.popups[0].content.textContent).toContain('Needs Review');
  act(() => {
    useMapStore.getState().toggleHotspots();
    useMapStore.getState().toggleDesigns();
  });
  expect(hotspot.remove).toHaveBeenCalled();
  expect(design.remove).toHaveBeenCalled();
  unmount();
  expect(provider.popups[0].remove).toHaveBeenCalledOnce();
});

it('weights the heatmap by votes, restores it after style reload, and cancels deferred attachment', async () => {
  const map = new MapFake();
  const { unmount } = render(<CommunityPinsLayer map={map.asMap()} />);
  expect(map.getSource('heatmap-source')).toBeUndefined();
  act(() => useMapStore.getState().toggleHeatmap());
  expect(map.getSource('heatmap-source')!.data.features[0]).toMatchObject({
    geometry: { coordinates: [-122.41, 37.7825] },
    properties: { weight: 142 },
  });
  expect(map.getLayer('heatmap-layer')!.type).toBe('heatmap');
  map.sources.clear();
  map.layers.clear();
  await act(() => map.emit('style.load'));
  expect(map.getSource('heatmap-source')).toBeDefined();
  act(() => useMapStore.getState().toggleHeatmap());
  expect(map.getLayer('heatmap-layer')).toBeUndefined();
  map.styleLoaded = false;
  act(() => useMapStore.getState().toggleHeatmap());
  act(() => useMapStore.getState().toggleHeatmap());
  await act(() => map.emit('styledata'));
  expect(map.getSource('heatmap-source')).toBeUndefined();
  act(() => useMapStore.getState().toggleHeatmap());
  await act(() => map.emit('styledata'));
  expect(map.getSource('heatmap-source')).toBeDefined();
  unmount();
  expect(map.sources.size).toBe(0);
});

const areas: ServiceArea[] = [
  {
    id: 'box',
    orgId: 'denver',
    name: 'Denver',
    areaType: 'bounding_box',
    bounds: { south: 39, west: -105, north: 40, east: -104 },
  },
  {
    id: 'polygon',
    orgId: 'denver',
    name: 'District',
    color: '#f00',
    areaType: 'polygon',
    geometry: JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [-105, 39],
          [-104, 40],
          [-105, 39],
        ],
      ],
    }),
  },
  { id: 'missing', orgId: 'denver', name: 'Missing', areaType: 'bounding_box' },
  { id: 'invalid', orgId: 'denver', name: 'Invalid', areaType: 'polygon', geometry: '{invalid' },
];
it('draws valid service bounds and polygons, skips malformed records, and rebuilds after style changes', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const map = new MapFake();
  const { rerender, unmount } = render(<ServiceAreaLayer map={null} />);
  rerender(<ServiceAreaLayer map={map.asMap()} activeServiceAreas={areas} />);
  expect(map.sources.size).toBe(0);
  act(() => useMapStore.getState().toggleServiceAreas());
  const features = map.getSource('service-areas-source')!.data.features;
  expect(features).toHaveLength(2);
  expect(features[0].geometry.coordinates[0]).toEqual([
    [-105, 39],
    [-104, 39],
    [-104, 40],
    [-105, 40],
    [-105, 39],
  ]);
  expect(features.map((f) => f.properties.color)).toEqual(['#00A1DE', '#f00']);
  expect(warning).toHaveBeenCalledWith(expect.stringContaining('Invalid'));
  map.sources.clear();
  map.layers.clear();
  await act(() => map.emit('style.load'));
  expect(map.layers.size).toBe(2);
  rerender(<ServiceAreaLayer map={map.asMap()} activeServiceAreas={[]} />);
  expect(map.layers.size).toBe(0);
  map.styleLoaded = false;
  rerender(<ServiceAreaLayer map={map.asMap()} activeServiceAreas={areas} />);
  await act(() => map.emit('styledata'));
  expect(map.layers.size).toBe(2);
  unmount();
  expect(map.sources.size).toBe(0);
  warning.mockRestore();
});
it('does not attach a pending service area after its component unmounts', async () => {
  useMapStore.setState({ showServiceAreas: true });
  const map = new MapFake();
  map.styleLoaded = false;
  const { unmount } = render(
    <ServiceAreaLayer map={map.asMap()} activeServiceAreas={[areas[0]]} />,
  );
  unmount();
  await map.emit('styledata');
  expect(map.sources.size).toBe(0);
});
