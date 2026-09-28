import type maplibregl from 'maplibre-gl';
import type { StreetSegment, CrossSectionElement, ElementType } from '@/lib/types';
import { offsetPolyline, computeElementOffsets } from './offset-polyline';
import { buildStreetSurfaceDetails } from './street-surface-details';
import {
  createMaterialImage,
  MAP_MATERIALS,
  MATERIAL_FOR_ELEMENT,
  materialImageId,
  type MaterialName,
} from './street-materials';

type LatLng = { lat: number; lng: number };

export interface RenderStreetResult {
  sourceIds: string[];
  layerIds: string[];
}

/**
 * Render a street cross-section on the map as polygon fills along a road path.
 * Returns the IDs of all created sources and layers so the caller can clean them up.
 */
export function renderStreetOnMap(
  map: maplibregl.Map,
  prefix: string,
  roadPath: LatLng[],
  street: StreetSegment,
  options: { opacity?: number } = {},
): RenderStreetResult {
  const { opacity = 0.96 } = options;
  const sourceIds: string[] = [];
  const layerIds: string[] = [];

  if (roadPath.length < 2) return { sourceIds, layerIds };

  // Each render owns its geometry, while tiny material images are shared by the
  // style. Roll back even a partial draw so a style swap can retry cleanly.
  const addSource = (id: string, data: GeoJSON.FeatureCollection) => {
    sourceIds.push(id);
    map.addSource(id, { type: 'geojson', data });
  };
  const addLayer = (layer: maplibregl.LayerSpecification) => {
    layerIds.push(layer.id);
    map.addLayer(layer);
  };

  try {
    const highlightSourceId = `${prefix}-highlight`;
    const highlightLayerId = `${prefix}-highlight-line`;
    const elementsSourceId = `${prefix}-elements`;

    // Road highlight centerline
    const highlightGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: roadPath.map((p) => [p.lng, p.lat]),
          },
          properties: { detail: 'path' },
        },
        ...buildStreetSurfaceDetails(roadPath, street),
      ],
    };

    addSource(highlightSourceId, highlightGeoJSON);

    addLayer({
      id: highlightLayerId,
      type: 'line',
      source: highlightSourceId,
      filter: ['==', ['get', 'detail'], 'path'],
      paint: {
        'line-color': '#39413c',
        'line-width': 1,
        'line-opacity': opacity * 0.3,
      },
    });

    // Element polygon fills
    const offsets = computeElementOffsets(
      street.elements.map((element) => ({
        width: Number.isFinite(element.width) && element.width > 0 ? element.width : 0,
      })),
      street.totalROWWidth,
    );
    const features: GeoJSON.Feature[] = [];

    street.elements.forEach((element: CrossSectionElement, i: number) => {
      const { centerOffset, width } = offsets[i];
      const material = MATERIAL_FOR_ELEMENT[element.type as ElementType];
      if (!material || width <= 0) return;
      const colors = MAP_MATERIALS[material];

      const innerOffset = centerOffset - width / 2;
      const outerOffset = centerOffset + width / 2;
      const innerEdge = offsetPolyline(roadPath, innerOffset);
      const outerEdge = offsetPolyline(roadPath, outerOffset);

      const ring = [
        ...innerEdge.map((p) => [p.lng, p.lat] as [number, number]),
        ...outerEdge.reverse().map((p) => [p.lng, p.lat] as [number, number]),
      ];
      if (ring.length > 0) {
        ring.push(ring[0]);
      }

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {
          elementIndex: i,
          elementType: element.type,
          material,
          fillColor: colors.color,
          strokeColor: colors.edge,
        },
      });
    });

    const elementsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    addSource(elementsSourceId, elementsGeoJSON);

    features.forEach((feature, i) => {
      const props = feature.properties!;
      const fillId = `${prefix}-element-fill-${i}`;
      const strokeId = `${prefix}-element-stroke-${i}`;

      const pattern = ensureMaterialImage(map, props.material);
      addLayer({
        id: fillId,
        type: 'fill',
        source: elementsSourceId,
        filter: ['==', ['get', 'elementIndex'], props.elementIndex],
        paint: {
          ...(pattern ? { 'fill-pattern': pattern } : { 'fill-color': props.fillColor }),
          'fill-opacity': opacity,
        },
      });

      addLayer({
        id: strokeId,
        type: 'line',
        source: elementsSourceId,
        filter: ['==', ['get', 'elementIndex'], props.elementIndex],
        paint: {
          'line-color': props.strokeColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 16, 0.3, 20, 1],
          'line-opacity': opacity * 0.55,
        },
      });
    });

    // Geometric joints and paint follow the street even through bends. Fade them
    // in at street scale; at neighborhood scale the material colors do the work.
    for (const detail of ['joint', 'marking', 'dash'] as const) {
      addLayer({
        id: `${prefix}-surface-${detail}`,
        type: 'line',
        source: highlightSourceId,
        minzoom: 17,
        filter: ['==', ['get', 'detail'], detail],
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            17,
            detail === 'joint' ? 0.4 : 0.6,
            20,
            detail === 'joint' ? 1 : 2.4,
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            17,
            0,
            18,
            opacity * (detail === 'joint' ? 0.5 : 0.9),
          ],
          ...(detail === 'dash' ? { 'line-dasharray': [6, 9] } : {}),
        },
      });
    }

    return { sourceIds, layerIds };
  } catch (error) {
    cleanupMapLayers(map, layerIds);
    for (const id of sourceIds) cleanupMapSource(map, id);
    throw error;
  }
}

/** No remote assets or async loading: material failure falls back to a solid fill. */
function ensureMaterialImage(map: maplibregl.Map, material: MaterialName): string | null {
  const id = materialImageId(material);
  try {
    if (!map.hasImage(id)) map.addImage(id, createMaterialImage(material), { pixelRatio: 2 });
    return id;
  } catch {
    return null;
  }
}

/** Remove layers by ID from the map (safe if already removed). */
export function cleanupMapLayers(map: maplibregl.Map, layerIds: string[]) {
  // React can remove the parent map before child overlays clean up on navigation.
  if (!map.getStyle()) return;
  for (const id of layerIds) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
}

/** Remove a source by ID from the map (safe if already removed). */
export function cleanupMapSource(map: maplibregl.Map, sourceId: string) {
  if (!map.getStyle()) return;
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}
