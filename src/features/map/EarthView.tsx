import { useEffect, useRef } from 'react';

interface EarthViewProps {
  map: google.maps.Map | null;
  enabled: boolean;
}

/**
 * Manages 3D / Google Earth-like view on the map.
 * Enables tilt + heading for a photorealistic tilted experience
 * when the user switches to "Earth" mode.
 */
export function EarthView({ map, enabled }: EarthViewProps) {
  const prevEnabledRef = useRef(false);

  useEffect(() => {
    if (!map) return;

    if (enabled && !prevEnabledRef.current) {
      // Entering 3D mode
      map.setMapTypeId('hybrid');
      map.setTilt(45);
      map.setHeading(0);

      // If zoomed out too far, zoom in for a better 3D effect
      const currentZoom = map.getZoom();
      if (currentZoom !== undefined && currentZoom < 15) {
        map.setZoom(15);
      }
    } else if (!enabled && prevEnabledRef.current) {
      // Exiting 3D mode
      map.setTilt(0);
      map.setHeading(0);
    }

    prevEnabledRef.current = enabled;
  }, [map, enabled]);

  // This is a behavior-only component, no visual output
  return null;
}
