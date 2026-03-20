import { useEffect, useState, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type MapStyleKey = 'roadmap' | 'satellite' | 'hybrid';

const TILE_STYLES: Record<MapStyleKey, maplibregl.StyleSpecification> = {
  roadmap: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }],
  },
  satellite: {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '&copy; Esri',
      },
    },
    layers: [{ id: 'esri-sat', type: 'raster', source: 'esri', minzoom: 0, maxzoom: 19 }],
  },
  hybrid: {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '&copy; Esri',
      },
      labels: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
      },
    },
    layers: [
      { id: 'esri-sat', type: 'raster', source: 'esri', minzoom: 0, maxzoom: 19 },
      { id: 'esri-labels', type: 'raster', source: 'labels', minzoom: 0, maxzoom: 19 },
    ],
  },
};

interface UseMapLibreOptions {
  mapElement: HTMLDivElement | null;
  center: { lat: number; lng: number };
  zoom: number;
  mapType: MapStyleKey;
}

interface UseMapLibreReturn {
  map: maplibregl.Map | null;
  isLoaded: boolean;
  error: string | null;
}

export function useMapLibre({
  mapElement,
  center,
  zoom,
  mapType,
}: UseMapLibreOptions): UseMapLibreReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initializedRef = useRef(false);

  // Initialize the map
  useEffect(() => {
    if (!mapElement || initializedRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapElement,
        style: TILE_STYLES[mapType],
        center: [center.lng, center.lat],
        zoom,
        attributionControl: {},
        maxZoom: 22,
      });

      map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
      map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');

      map.on('load', () => {
        setIsLoaded(true);
      });

      map.on('error', (e) => {
        console.error('[MapLibre]', e.error);
      });

      mapRef.current = map;
      initializedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map');
    }

    return () => {
      // Don't destroy on unmount — React strict mode double-fires
    };
  }, [mapElement]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync center
  const syncCenter = useCallback(() => {
    if (!mapRef.current) return;
    const cur = mapRef.current.getCenter();
    if (
      Math.abs(cur.lat - center.lat) > 0.0001 ||
      Math.abs(cur.lng - center.lng) > 0.0001
    ) {
      mapRef.current.panTo([center.lng, center.lat]);
    }
  }, [center]);

  useEffect(() => {
    syncCenter();
  }, [syncCenter]);

  // Sync zoom
  useEffect(() => {
    if (!mapRef.current) return;
    const curZoom = mapRef.current.getZoom();
    if (Math.abs(curZoom - zoom) > 0.1) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // Sync map type / style
  useEffect(() => {
    if (!mapRef.current || !initializedRef.current) return;
    mapRef.current.setStyle(TILE_STYLES[mapType]);
  }, [mapType]);

  return {
    map: mapRef.current,
    isLoaded,
    error,
  };
}
