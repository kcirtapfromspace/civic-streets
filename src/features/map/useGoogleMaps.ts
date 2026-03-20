import { useEffect, useState, useRef, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface UseGoogleMapsOptions {
  mapElement: HTMLDivElement | null;
  center: { lat: number; lng: number };
  zoom: number;
  mapType: string;
  mapId?: string;
}

interface UseGoogleMapsReturn {
  map: google.maps.Map | null;
  isLoaded: boolean;
  error: string | null;
  google: typeof google | null;
}

let optionsSet = false;
let loadPromise: Promise<void> | null = null;

/**
 * Initialize the Google Maps JS API using the new functional API
 * (setOptions + importLibrary). Loads maps, places, marker, and
 * visualization libraries.
 */
function ensureLoaded(apiKey: string): Promise<void> {
  if (loadPromise) return loadPromise;

  if (!optionsSet) {
    setOptions({
      key: apiKey,
      v: 'weekly',
    });
    optionsSet = true;
  }

  // Import all required libraries in parallel.
  // importLibrary triggers the actual script load on first call.
  loadPromise = Promise.all([
    importLibrary('maps'),
    importLibrary('places'),
    importLibrary('marker'),
    importLibrary('visualization'),
    importLibrary('geometry'),
  ]).then(() => undefined);

  return loadPromise;
}

export function useGoogleMaps({
  mapElement,
  center,
  zoom,
  mapType,
  mapId,
}: UseGoogleMapsOptions): UseGoogleMapsReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleRef, setGoogleRef] = useState<typeof google | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const initializedRef = useRef(false);

  // Initialize the map
  useEffect(() => {
    if (!mapElement || initializedRef.current) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError('VITE_GOOGLE_MAPS_API_KEY');
      return;
    }

    let cancelled = false;

    ensureLoaded(apiKey)
      .then(() => {
        if (cancelled || !mapElement) return;

        const mapOptions: google.maps.MapOptions = {
          center,
          zoom,
          mapTypeId: mapType,
          mapId: mapId || import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined,
          zoomControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          mapTypeControl: false, // We manage this in our controls
          gestureHandling: 'greedy',
        };

        const map = new google.maps.Map(mapElement, mapOptions);
        mapRef.current = map;
        initializedRef.current = true;
        setGoogleRef(google);
        setIsLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load Google Maps');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mapElement]); // Only initialize once when the element is ready

  // Sync center changes
  const syncCenter = useCallback(() => {
    if (!mapRef.current) return;
    const currentCenter = mapRef.current.getCenter();
    if (
      currentCenter &&
      (Math.abs(currentCenter.lat() - center.lat) > 0.0001 ||
        Math.abs(currentCenter.lng() - center.lng) > 0.0001)
    ) {
      mapRef.current.panTo(center);
    }
  }, [center]);

  useEffect(() => {
    syncCenter();
  }, [syncCenter]);

  // Sync zoom changes
  useEffect(() => {
    if (!mapRef.current) return;
    const currentZoom = mapRef.current.getZoom();
    if (currentZoom !== undefined && currentZoom !== zoom) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // Sync map type changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapType);
  }, [mapType]);

  return {
    map: mapRef.current,
    isLoaded,
    error,
    google: googleRef,
  };
}
