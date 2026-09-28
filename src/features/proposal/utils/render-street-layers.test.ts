import { describe, expect, it } from 'vitest';
import { validateStyleMin, type StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { MapFake } from '@/features/map/__tests__/map-fake';
import { element, street } from '@/features/editor/__tests__/fixtures';
import { MATERIAL_FOR_ELEMENT, MAP_MATERIALS, materialImageId } from './street-materials';
import { cleanupMapLayers, cleanupMapSource, renderStreetOnMap } from './render-street-layers';
import type { ElementType } from '@/lib/types';

const path = [
  { lat: 39.74, lng: -104.99 },
  { lat: 39.741, lng: -104.99 },
];

describe('map street materials', () => {
  it('draws distinct shared material patterns with valid MapLibre styling and street-scale details', () => {
    const map = new MapFake();
    const types = Object.keys(MATERIAL_FOR_ELEMENT) as ElementType[];
    const concept = street(types.map((type) => element(type, type)));
    const rendered = renderStreetOnMap(map.asMap(), 'material', path, concept);
    expect(map.images.size).toBe(Object.keys(MAP_MATERIALS).length);
    types.forEach((type, i) => {
      const paint = map.layers.get(`material-element-fill-${i}`)!.paint;
      expect(map.images.has(paint['fill-pattern'] as string)).toBe(true);
      expect(paint['fill-pattern']).toBe(materialImageId(MATERIAL_FOR_ELEMENT[type]));
      expect(paint['fill-opacity']).toBeGreaterThan(0.9);
    });
    expect(map.layers.get('material-element-fill-1')!.paint['fill-pattern']).not.toEqual(
      map.layers.get('material-element-fill-3')!.paint['fill-pattern'],
    );
    const details = map.sources.get('material-highlight')!.data.features;
    expect(details.some((feature) => feature.properties.detail === 'joint')).toBe(true);
    expect(details.some((feature) => feature.properties.detail === 'marking')).toBe(true);
    const style = {
      version: 8,
      sources: Object.fromEntries(
        [...map.sources].map(([id, source]) => [id, { type: source.type, data: source.data }]),
      ),
      layers: [...map.layers.values()],
    } as StyleSpecification;
    expect(validateStyleMin(style)).toEqual([]);

    // A second draft shares a style atlas; disposing one never removes the other's assets.
    renderStreetOnMap(map.asMap(), 'second', path, concept);
    expect(map.addImage).toHaveBeenCalledTimes(Object.keys(MAP_MATERIALS).length);
    cleanupMapLayers(map.asMap(), rendered.layerIds);
    rendered.sourceIds.forEach((id) => cleanupMapSource(map.asMap(), id));
    expect(map.layers.has('second-element-fill-0')).toBe(true);
    expect(map.images.size).toBe(Object.keys(MAP_MATERIALS).length);
  });

  it('recreates missing images after a style change', () => {
    const map = new MapFake();
    renderStreetOnMap(map.asMap(), 'first', path, street());
    const imageCount = map.images.size;
    map.images.clear();
    map.layers.clear();
    map.sources.clear();
    renderStreetOnMap(map.asMap(), 'first', path, street());
    expect(map.images.size).toBe(imageCount);
    expect(map.addImage).toHaveBeenCalledTimes(imageCount * 2);
    expect(map.layers.has('first-surface-joint')).toBe(true);
  });

  it('keeps an opaque readable concept if the material atlas rejects an image', () => {
    const map = new MapFake();
    map.addImage.mockImplementation(() => {
      throw new Error('Atlas unavailable');
    });
    renderStreetOnMap(map.asMap(), 'fallback', path, street());
    expect(map.layers.get('fallback-element-fill-0')!.paint).toEqual({
      'fill-color': MAP_MATERIALS.concrete.color,
      'fill-opacity': 0.96,
    });
    expect(map.sources.get('fallback-elements')!.data.features).toHaveLength(2);
    expect(map.layers.has('fallback-surface-joint')).toBe(true);
  });

  it('cleans up late detail-layer failures and permits a complete retry', () => {
    const map = new MapFake();
    const addLayer = map.addLayer.getMockImplementation()!;
    map.addLayer.mockImplementation((layer) => {
      addLayer(layer);
      if (layer.id.endsWith('-surface-dash')) throw new Error('Style replaced');
    });
    expect(() => renderStreetOnMap(map.asMap(), 'retry', path, street())).toThrow('Style replaced');
    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);
    map.addLayer.mockImplementation(addLayer);
    expect(() => renderStreetOnMap(map.asMap(), 'retry', path, street())).not.toThrow();
    expect(map.layers.has('retry-surface-dash')).toBe(true);
  });

  it('does not let invalid widths corrupt the following material geometry', () => {
    const map = new MapFake();
    const invalid = [0, -2, NaN, Infinity].map((width, i) =>
      element(`invalid-${i}`, 'sidewalk', width),
    );
    const concept = street([...invalid, element('valid', 'bike-lane', 5)]);
    renderStreetOnMap(map.asMap(), 'widths', path, concept);
    const features = map.sources.get('widths-elements')!.data.features;
    expect(features).toHaveLength(1);
    expect(features[0].properties.elementIndex).toBe(4);
    expect((features[0].geometry.coordinates as number[][][]).flat(2).every(Number.isFinite)).toBe(
      true,
    );
  });
});
