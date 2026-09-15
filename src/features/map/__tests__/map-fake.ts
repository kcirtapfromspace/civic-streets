import { vi } from 'vitest';
import type maplibregl from 'maplibre-gl';

type Listener = (payload?: unknown) => unknown;
type Geometry = { type: string; coordinates: number[] | number[][] | number[][][] };
type Feature = { geometry: Geometry; properties: Record<string, unknown> };
// This fixture exposes the common fields inspected on line and collection sources.
type SourceData = { geometry: Geometry; features: Feature[] };
type Source = { type: string; data: SourceData; setData: ReturnType<typeof vi.fn> };
type Layer = { id: string; type: string; paint: Record<string, unknown> };
export class MapFake {
  listeners = new Map<string, Set<Listener>>();
  sources = new Map<string, Source>();
  layers = new Map<string, Layer>();
  canvas = document.createElement('canvas');
  container = document.createElement('div');
  center = { lat: 39.7, lng: -104.9 };
  zoom = 12;
  styleLoaded = true;
  on = vi.fn((event: string, listener: Listener) => {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  });
  off = vi.fn((event: string, listener: Listener) => {
    this.listeners.get(event)?.delete(listener);
    return this;
  });
  once = vi.fn((event: string, listener: Listener) => {
    // MapLibre off(event, originalCallback) also removes a once subscription.
    this.on(event, listener);
    this.onceListeners.add(listener);
    return this;
  });
  onceListeners = new Set<Listener>();
  async emit(event: string, payload?: unknown) {
    const pending = [...(this.listeners.get(event) ?? [])].map((listener) => {
      if (this.onceListeners.delete(listener)) this.off(event, listener);
      return listener(payload);
    });
    await Promise.all(pending);
  }
  addSource = vi.fn((id: string, spec: { type: string; data: unknown }) => {
    if (this.sources.has(id)) throw new Error(`Duplicate source ${id}`);
    const source: Source = {
      ...spec,
      data: spec.data as SourceData,
      setData: vi.fn((data: unknown) => {
        source.data = data as SourceData;
      }),
    };
    this.sources.set(id, source);
  });
  getSource = vi.fn((id: string) => this.sources.get(id));
  removeSource = vi.fn((id: string) => {
    this.sources.delete(id);
  });
  addLayer = vi.fn((layer: Layer) => {
    if (this.layers.has(layer.id)) throw new Error(`Duplicate layer ${layer.id}`);
    this.layers.set(layer.id, layer);
  });
  getLayer = vi.fn((id: string) => this.layers.get(id));
  removeLayer = vi.fn((id: string) => {
    this.layers.delete(id);
  });
  isStyleLoaded = vi.fn(() => this.styleLoaded);
  getCanvas = () => this.canvas;
  getContainer = () => this.container;
  getCenter = () => this.center;
  getZoom = () => this.zoom;
  setZoom = vi.fn((zoom: number) => {
    this.zoom = zoom;
  });
  easeTo = vi.fn();
  jumpTo = vi.fn(({ center, zoom }: { center: number[]; zoom: number }) => {
    this.center = { lng: center[0], lat: center[1] };
    this.zoom = zoom;
  });
  setStyle = vi.fn();
  addControl = vi.fn();
  remove = vi.fn(() => {
    this.listeners.clear();
    this.sources.clear();
    this.layers.clear();
  });
  project = vi.fn(() => ({ x: 120, y: 80 }));
  dragPan = { enable: vi.fn(), disable: vi.fn() };
  asMap() {
    return this as unknown as maplibregl.Map;
  }
}
export const mouse = (lat = 39.7, lng = -104.9, button = 0) => ({
  lngLat: { lat, lng },
  originalEvent: { button },
  preventDefault: vi.fn(),
});
