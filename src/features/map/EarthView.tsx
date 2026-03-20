import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';

interface EarthViewProps {
  map: maplibregl.Map | null;
  enabled: boolean;
}

/**
 * Manages 3D / tilted view on the map.
 * Enables pitch + bearing for a tilted perspective
 * when the user switches to "Earth" mode.
 */
export function EarthView({ map, enabled }: EarthViewProps) {
  const prevEnabledRef = useRef(false);

  useEffect(() => {
    if (!map) return;

    if (enabled && !prevEnabledRef.current) {
      // Entering 3D mode
      map.easeTo({
        pitch: 60,
        bearing: 0,
        duration: 800,
      });

      // If zoomed out too far, zoom in for a better 3D effect
      const currentZoom = map.getZoom();
      if (currentZoom < 15) {
        map.setZoom(15);
      }
    } else if (!enabled && prevEnabledRef.current) {
      // Exiting 3D mode
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
    }

    prevEnabledRef.current = enabled;
  }, [map, enabled]);

  return null;
}
