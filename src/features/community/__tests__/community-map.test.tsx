import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type maplibregl from 'maplibre-gl';
import { mapFixture, TestMap } from './map-fixture';
import { DrawingTool } from '../DrawingTool';
import { ExplorerMinimap } from '../ExplorerMinimap';
import type { HotspotPin } from '@/lib/types';

vi.mock('maplibre-gl', async () => ({ default: (await import('./map-fixture')).maplibreFixture }));
vi.mock('@/lib/api/geocoding', () => ({ searchPlaces: vi.fn() }));
const pin: HotspotPin = {
  id: 'crossing',
  lat: 39.74,
  lng: -104.99,
  category: 'accessibility',
  title: 'Curb ramp needed',
  severity: 'high',
  status: 'open',
  upvotes: 42,
  commentCount: 3,
};
beforeEach(() => mapFixture.reset());
afterEach(cleanup);

describe('community minimap marker interactions', () => {
  it('fits initial pins, publishes current bounds, highlights selection, and opens a safe report popup', () => {
    const click = vi.fn(),
      hover = vi.fn(),
      oldBounds = vi.fn(),
      currentBounds = vi.fn();
    const { rerender, unmount } = render(
      <ExplorerMinimap
        hotspots={[pin]}
        onPinClick={click}
        onPinHover={hover}
        onBoundsChange={oldBounds}
      />,
    );
    const map = mapFixture.maps[0];
    const marker = mapFixture.markers[0];
    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [-104.99, 39.74],
        [-104.99, 39.74],
      ],
      expect.objectContaining({ maxZoom: 14 }),
    );
    fireEvent.mouseEnter(marker.element);
    expect(hover).toHaveBeenLastCalledWith('crossing');
    fireEvent.mouseLeave(marker.element);
    expect(hover).toHaveBeenLastCalledWith(null);
    fireEvent.click(marker.element);
    expect(click).toHaveBeenCalledWith('crossing');
    expect(screen.getByRole('link', { name: 'View Details →' })).toHaveAttribute(
      'href',
      '/hotspot/crossing',
    );
    fireEvent.click(marker.element);
    expect(mapFixture.popups).toHaveLength(1);
    rerender(
      <ExplorerMinimap
        hotspots={[pin]}
        onPinClick={click}
        onPinHover={hover}
        onBoundsChange={currentBounds}
        hoveredId="crossing"
        selectedId="crossing"
      />,
    );
    const currentMarker = mapFixture.markers.at(-1)!;
    expect(marker.remove).toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledOnce();
    expect(currentMarker.element.style.transform).toContain('scale(1.4)');
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: { lng: -104.99, lat: 39.74 }, zoom: 15 }),
    );
    act(() => map.emit('moveend'));
    expect(currentBounds).toHaveBeenCalledWith({
      minLat: 39.7,
      maxLat: 39.8,
      minLng: -105,
      maxLng: -104.9,
    });
    expect(oldBounds).not.toHaveBeenCalled();
    rerender(<ExplorerMinimap hotspots={[pin]} selectedId="missing" />);
    expect(mapFixture.markers.at(-1)!.element.style.transform).not.toContain('scale');
    unmount();
    expect(map.remove).toHaveBeenCalledOnce();
    expect(mapFixture.popups[0].remove).toHaveBeenCalled();
    expect(mapFixture.markers.at(-1)!.remove).toHaveBeenCalled();
  });
  it('waits for map style before adding pins and cancels stale load callbacks after replacement or unmount', () => {
    mapFixture.loaded = false;
    const { rerender, unmount } = render(<ExplorerMinimap hotspots={[pin]} />);
    const map = mapFixture.maps[0];
    expect(mapFixture.markers).toHaveLength(0);
    rerender(<ExplorerMinimap hotspots={[{ ...pin, id: 'replacement', title: 'Replacement' }]} />);
    act(() => map.emit('load'));
    expect(mapFixture.markers).toHaveLength(1);
    fireEvent.click(mapFixture.markers[0].element);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/hotspot/replacement');
    unmount();
    mapFixture.loaded = false;
    const second = render(<ExplorerMinimap hotspots={[pin]} />);
    const secondMap = mapFixture.maps[1];
    second.unmount();
    act(() => secondMap.emit('load'));
    expect(mapFixture.markers).toHaveLength(1);
  });
});

describe('drawing a community search polygon', () => {
  function setup(enabled = true) {
    const map = new TestMap({ container: document.createElement('div') });
    map.zoomEnabled = enabled;
    const complete = vi.fn(),
      clear = vi.fn();
    const view = render(
      <DrawingTool
        map={map as unknown as maplibregl.Map}
        onPolygonComplete={complete}
        onClear={clear}
      />,
    );
    return { map, complete, clear, ...view };
  }
  function clickMap(map: TestMap, lng: number, lat: number) {
    act(() => map.emit('click', { lngLat: { lng, lat } }));
  }
  it('builds and closes a polygon only after three vertices, then restores normal map interaction', () => {
    const { map, complete, clear, unmount } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    expect(map.zoomEnabled).toBe(false);
    expect(map.getCanvas().style.cursor).toBe('crosshair');
    clickMap(map, -105, 39.7);
    clickMap(map, -104.9, 39.7);
    expect(map.getSource('drawing-polygon-source')!.data.features[0].geometry.type).toBe(
      'LineString',
    );
    const preventDefault = vi.fn();
    act(() => map.emit('dblclick', { preventDefault }));
    expect(complete).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
    clickMap(map, -105, 39.8);
    act(() => map.emit('dblclick', { preventDefault }));
    expect(complete).toHaveBeenCalledWith([
      [-105, 39.7],
      [-104.9, 39.7],
      [-105, 39.8],
    ]);
    expect(map.getSource('drawing-polygon-source')!.data.features[0].geometry).toEqual({
      type: 'Polygon',
      coordinates: [
        [
          [-105, 39.7],
          [-104.9, 39.7],
          [-105, 39.8],
          [-105, 39.7],
        ],
      ],
    });
    expect(map.zoomEnabled).toBe(true);
    expect(map.getCanvas().style.cursor).toBe('');
    expect(map.listeners.get('click')?.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(clear).toHaveBeenCalledOnce();
    expect(map.sources.size).toBe(0);
    expect(map.layers.size).toBe(0);
    unmount();
  });
  it('cancels an unfinished polygon with Escape or Cancel and removes listeners and layers on unmount', () => {
    const { map, clear, unmount } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    clickMap(map, -105, 39.7);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(clear).toHaveBeenCalledOnce();
    expect(map.zoomEnabled).toBe(true);
    expect(map.sources.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(clear).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    unmount();
    expect(map.sources.size).toBe(0);
    expect(map.zoomEnabled).toBe(true);
    expect(map.listeners.get('click')?.size).toBe(0);
  });
  it('preserves a map whose double-click zoom was disabled before drawing', () => {
    const { map, unmount } = setup(false);
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(map.zoomEnabled).toBe(false);
    expect(map.doubleClickZoom.enable).not.toHaveBeenCalled();
    unmount();
  });
});
