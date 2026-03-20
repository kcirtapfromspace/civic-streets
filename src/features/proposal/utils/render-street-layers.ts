import type maplibregl from 'maplibre-gl';
import type { StreetSegment, CrossSectionElement, ElementType } from '@/lib/types';
import { ELEMENT_COLORS } from '@/lib/constants/colors';
import { offsetPolyline, computeElementOffsets } from './offset-polyline';

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
  const { opacity = 0.7 } = options;
  const sourceIds: string[] = [];
  const layerIds: string[] = [];

  if (roadPath.length < 2) return { sourceIds, layerIds };

  const highlightSourceId = `${prefix}-highlight`;
  const highlightLayerId = `${prefix}-highlight-line`;
  const elementsSourceId = `${prefix}-elements`;

  // Road highlight centerline
  const highlightGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: roadPath.map((p) => [p.lng, p.lat]),
      },
      properties: {},
    }],
  };

  map.addSource(highlightSourceId, { type: 'geojson', data: highlightGeoJSON });
  sourceIds.push(highlightSourceId);

  map.addLayer({
    id: highlightLayerId,
    type: 'line',
    source: highlightSourceId,
    paint: {
      'line-color': '#3B82F6',
      'line-width': 4,
      'line-opacity': opacity * 0.57,
    },
  });
  layerIds.push(highlightLayerId);

  // Element polygon fills
  const offsets = computeElementOffsets(street.elements, street.totalROWWidth);
  const features: GeoJSON.Feature[] = [];

  street.elements.forEach((element: CrossSectionElement, i: number) => {
    const { centerOffset, width } = offsets[i];
    const colors = ELEMENT_COLORS[element.type as ElementType];
    if (!colors) return;

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
        fillColor: colors.fill,
        strokeColor: colors.stroke,
      },
    });
  });

  const elementsGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  map.addSource(elementsSourceId, { type: 'geojson', data: elementsGeoJSON });
  sourceIds.push(elementsSourceId);

  features.forEach((feature, i) => {
    const props = feature.properties!;
    const fillId = `${prefix}-element-fill-${i}`;
    const strokeId = `${prefix}-element-stroke-${i}`;

    map.addLayer({
      id: fillId,
      type: 'fill',
      source: elementsSourceId,
      filter: ['==', ['get', 'elementIndex'], props.elementIndex],
      paint: {
        'fill-color': props.fillColor,
        'fill-opacity': opacity,
      },
    });

    map.addLayer({
      id: strokeId,
      type: 'line',
      source: elementsSourceId,
      filter: ['==', ['get', 'elementIndex'], props.elementIndex],
      paint: {
        'line-color': props.strokeColor,
        'line-width': 1,
        'line-opacity': opacity * 0.71,
      },
    });

    layerIds.push(fillId, strokeId);
  });

  return { sourceIds, layerIds };
}

/** Remove layers by ID from the map (safe if already removed). */
export function cleanupMapLayers(map: maplibregl.Map, layerIds: string[]) {
  for (const id of layerIds) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
}

/** Remove a source by ID from the map (safe if already removed). */
export function cleanupMapSource(map: maplibregl.Map, sourceId: string) {
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}
