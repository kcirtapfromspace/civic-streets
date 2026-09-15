import { vi } from 'vitest';

export const mapFixture = {
  loaded: true,
  maps: [] as TestMap[],
  markers: [] as TestMarker[],
  popups: [] as TestPopup[],
  reset() {
    this.loaded = true;
    this.maps = [];
    this.markers = [];
    this.popups = [];
  },
};

export class TestMap {
  container: HTMLElement;
  canvas = document.createElement('canvas');
  listeners = new Map<string, Set<(event: unknown) => void>>();
  sources = new Map<
    string,
    { data: GeoJSON.FeatureCollection; setData: (data: GeoJSON.FeatureCollection) => void }
  >();
  layers = new Map<string, unknown>();
  bounds = {
    getSouth: () => 39.7,
    getNorth: () => 39.8,
    getWest: () => -105,
    getEast: () => -104.9,
  };
  zoomEnabled = true;
  doubleClickZoom = {
    isEnabled: () => this.zoomEnabled,
    enable: vi.fn(() => {
      this.zoomEnabled = true;
    }),
    disable: vi.fn(() => {
      this.zoomEnabled = false;
    }),
  };
  addControl = vi.fn();
  fitBounds = vi.fn();
  flyTo = vi.fn();
  remove = vi.fn();
  constructor(options: { container: HTMLElement }) {
    this.container = options.container;
    mapFixture.maps.push(this);
  }
  isStyleLoaded() {
    return mapFixture.loaded;
  }
  getBounds() {
    return this.bounds;
  }
  getCanvas() {
    return this.canvas;
  }
  on(type: string, listener: (event: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return this;
  }
  off(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener);
    return this;
  }
  once(type: string, listener: (event: unknown) => void) {
    return this.on(type, listener);
  }
  emit(type: string, event: unknown = {}) {
    const callbacks = [...(this.listeners.get(type) ?? [])];
    if (type === 'load') {
      mapFixture.loaded = true;
      this.listeners.delete(type);
    }
    for (const callback of callbacks) callback(event);
  }
  addSource(id: string, value: { data: GeoJSON.FeatureCollection }) {
    const source = {
      data: value.data,
      setData(data: GeoJSON.FeatureCollection) {
        source.data = data;
      },
    };
    this.sources.set(id, source);
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  removeSource(id: string) {
    this.sources.delete(id);
  }
  addLayer(layer: { id: string }) {
    this.layers.set(layer.id, layer);
  }
  getLayer(id: string) {
    return this.layers.get(id);
  }
  removeLayer(id: string) {
    this.layers.delete(id);
  }
}

export class TestMarker {
  element: HTMLElement;
  coordinates: [number, number] = [0, 0];
  remove = vi.fn(() => this.element.remove());
  constructor({ element }: { element: HTMLElement }) {
    this.element = element;
    mapFixture.markers.push(this);
  }
  setLngLat(coordinates: [number, number]) {
    this.coordinates = coordinates;
    return this;
  }
  addTo(map: TestMap) {
    map.container.appendChild(this.element);
    return this;
  }
  getElement() {
    return this.element;
  }
  getLngLat() {
    return { lng: this.coordinates[0], lat: this.coordinates[1] };
  }
}
export class TestPopup {
  content?: HTMLElement;
  coordinates?: [number, number];
  remove = vi.fn(() => this.content?.remove());
  constructor() {
    mapFixture.popups.push(this);
  }
  setLngLat(coordinates: [number, number]) {
    this.coordinates = coordinates;
    return this;
  }
  setDOMContent(content: HTMLElement) {
    this.content = content;
    return this;
  }
  addTo(map: TestMap) {
    if (this.content) map.container.appendChild(this.content);
    return this;
  }
}

export const maplibreFixture = {
  Map: TestMap,
  Marker: TestMarker,
  Popup: TestPopup,
  NavigationControl: class {},
};
