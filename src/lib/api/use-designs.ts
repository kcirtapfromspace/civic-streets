import { useEffect, useMemo, useState } from 'react';
import { useConvex, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { convexAvailable } from './convex-provider';
import { MOCK_DESIGNS as MAP_MOCK_DESIGNS } from '@/features/map/mock-data';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import type { StreetSegment } from '@/lib/types';
import { isStreet } from '@/stores/saved-proposals-store';
import type { DesignPin } from '@/lib/types/community';

function convexDesignToPin(doc: Doc<'designs'>): DesignPin {
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
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}) {
  const queryBounds = bounds ?? { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
  const convexDocs = useQuery(api.designs.getByBounds, queryBounds);

  const pins = useMemo(() => {
    if (!convexDocs) return [];
    return convexDocs.map(convexDesignToPin);
  }, [convexDocs]);

  return { designs: pins, isLoading: convexDocs === undefined };
}

/** Design pins for map rendering within bounds — mock implementation. */
function useDesignsByBoundsMock(bounds?: {
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

export const useDesignsByBounds = convexAvailable
  ? useDesignsByBoundsConvex
  : useDesignsByBoundsMock;

export type DesignLoadResult =
  | { id: string; status: 'loading' | 'missing' | 'unavailable' | 'error' }
  | { id: string; status: 'ready'; street: StreetSegment; beforeStreet: StreetSegment | null };

function useDesignByIdConnected(id: string, attempt = 0): DesignLoadResult {
  const client = useConvex();
  const [snapshot, setSnapshot] = useState<{ attempt: number; result: DesignLoadResult }>({
    attempt,
    result: { id, status: 'loading' },
  });
  useEffect(() => {
    let active = true;
    const setResult = (result: DesignLoadResult) => setSnapshot({ attempt, result });
    client
      .query(api.designs.getById, { designId: id as Id<'designs'> })
      .then((doc) => {
        if (!active) return;
        if (!doc) {
          setResult({ id, status: 'missing' });
          return;
        }
        const street: unknown = JSON.parse(doc.streetData);
        const beforeStreet: unknown = doc.beforeStreetData
          ? JSON.parse(doc.beforeStreetData)
          : null;
        if (!isStreet(street) || (beforeStreet !== null && !isStreet(beforeStreet))) {
          throw new Error('This design contains unsupported street data');
        }
        setResult({ id, status: 'ready', street, beforeStreet });
      })
      .catch(() => {
        if (active) setResult({ id, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [client, id, attempt]);
  // A route change must never briefly show the previous design.
  return snapshot.result.id === id && snapshot.attempt === attempt
    ? snapshot.result
    : { id, status: 'loading' };
}

function useDesignByIdDemo(id: string, _attempt = 0): DesignLoadResult {
  return { id, status: 'unavailable' };
}

/** Public designs only; private or removed records are deliberately indistinguishable. */
export const useDesignById = convexAvailable ? useDesignByIdConnected : useDesignByIdDemo;
