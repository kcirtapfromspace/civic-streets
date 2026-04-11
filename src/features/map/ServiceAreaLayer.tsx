import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapStore } from './map-store';
import { useStyleReload } from './useStyleReload';

export interface ServiceAreaBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface ServiceArea {
  id: string;
  name: string;
  orgId: string;
  color?: string;
  areaType: 'bounding_box' | 'polygon';
  bounds?: ServiceAreaBounds;
  /** GeoJSON geometry string (for polygon type) */
  geometry?: string;
}

interface ServiceAreaLayerProps {
  map: maplibregl.Map | null;
  /** Service areas to render. If omitted, nothing is drawn. */
  activeServiceAreas?: ServiceArea[];
}

const SOURCE_ID = 'service-areas-source';
const FILL_LAYER_ID = 'service-areas-fill';
const LINE_LAYER_ID = 'service-areas-line';

export function ServiceAreaLayer({ map, activeServiceAreas = [] }: ServiceAreaLayerProps) {
  const showServiceAreas = useMapStore((s) => s.showServiceAreas);
  const styleVersion = useStyleReload(map);

  useEffect(() => {
    if (!map) return;

    const cleanup = () => {
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };

    // Always clean up first (handles style reload case)
    cleanup();

    if (!showServiceAreas || activeServiceAreas.length === 0) return;

    // Build GeoJSON FeatureCollection from service areas
    const features = activeServiceAreas
      .map((area) => {
        let coordinates: number[][][] | undefined;

        if (area.areaType === 'bounding_box' && area.bounds) {
          const { south, west, north, east } = area.bounds;
          coordinates = [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ];
        } else if (area.areaType === 'polygon' && area.geometry) {
          try {
            const geojson = JSON.parse(area.geometry);
            coordinates = geojson.coordinates;
          } catch {
            console.warn(`[ServiceAreaLayer] Failed to parse geometry for area "${area.name}"`);
            return null;
          }
        }

        if (!coordinates) return null;

        return {
          type: 'Feature' as const,
          properties: {
            color: area.color || '#00A1DE',
            name: area.name,
            id: area.id,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates,
          },
        };
      })
      .filter(Boolean);

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: features as GeoJSON.Feature[],
    };

    const addLayers = () => {
      // Guard: source may already exist if addLayers fires twice
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      // Fill layer — semi-transparent coverage area
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.08,
        },
      });

      // Line layer — dashed boundary border
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.5,
          'line-dasharray': [4, 3],
          'line-opacity': 0.7,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once('styledata', addLayers);
    }

    return cleanup;
  }, [map, showServiceAreas, activeServiceAreas, styleVersion]);

  return null;
}
