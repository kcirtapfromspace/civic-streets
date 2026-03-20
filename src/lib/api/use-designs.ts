import { useMemo } from 'react';
import { MOCK_DESIGNS as MAP_MOCK_DESIGNS } from '@/features/map/mock-data';
import type { DesignPin } from '@/lib/types/community';

/** Design pins for map rendering within bounds. */
export function useDesignsByBounds(bounds?: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}) {
  const pins = useMemo(() => {
    const allPins: DesignPin[] = [...MAP_MOCK_DESIGNS];

    if (!bounds) return allPins;

    return allPins.filter(
      (p) =>
        p.lat >= bounds.minLat &&
        p.lat <= bounds.maxLat &&
        p.lng >= bounds.minLng &&
        p.lng <= bounds.maxLng,
    );
  }, [bounds]);

  return { designs: pins, isLoading: false };
}
