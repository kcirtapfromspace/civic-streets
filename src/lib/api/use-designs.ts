import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { convexAvailable } from './convex-provider';
import { MOCK_DESIGNS as MAP_MOCK_DESIGNS } from '@/features/map/mock-data';
import type { DesignPin } from '@/lib/types/community';

function convexDesignToPin(doc: Record<string, any>): DesignPin {
  return {
    id: doc._id,
    title: doc.title,
    lat: doc.lat ?? 0,
    lng: doc.lng ?? 0,
    upvotes: doc.upvotes ?? 0,
    prowagPass: doc.prowagPass ?? false,
    templateId: doc.templateId,
  };
}

/** Design pins for map rendering within bounds — Convex implementation. */
function useDesignsByBoundsConvex(bounds?: {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}) {
  const convexDocs = useQuery(
    api.designs.getByBounds,
    bounds ? bounds : 'skip',
  );

  const pins = useMemo(() => {
    if (!convexDocs) return [];
    return convexDocs.map(convexDesignToPin);
  }, [convexDocs]);

  return { designs: pins, isLoading: convexDocs === undefined };
}

/** Design pins for map rendering within bounds — mock implementation. */
function useDesignsByBoundsMock(bounds?: {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}) {
  const pins = useMemo(() => {
    const allPins: DesignPin[] = [...MAP_MOCK_DESIGNS];
    if (!bounds) return allPins;
    return allPins.filter(
      (p) =>
        p.lat >= bounds.minLat && p.lat <= bounds.maxLat &&
        p.lng >= bounds.minLng && p.lng <= bounds.maxLng,
    );
  }, [bounds]);

  return { designs: pins, isLoading: false };
}

export const useDesignsByBounds = convexAvailable ? useDesignsByBoundsConvex : useDesignsByBoundsMock;
