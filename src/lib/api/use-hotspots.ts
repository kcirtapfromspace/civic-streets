import { useMemo, useCallback } from 'react';
import { convexAvailable } from './convex-provider';
import { MOCK_HOTSPOTS as COMMUNITY_MOCK_HOTSPOTS } from '@/features/community/mock-data';
import { MOCK_HOTSPOTS as MAP_MOCK_HOTSPOTS } from '@/features/map/mock-data';
import { useLocalHotspotsStore } from '@/stores/local-hotspots-store';
import type { MockHotspot } from '@/features/community/mock-data';
import type { HotspotPin, HotspotCategory, HotspotSeverity, HotspotStatus, IssueGroup, IssueType } from '@/lib/types/community';

// Convex imports — only used when convexAvailable
// import { useQuery, useMutation } from 'convex/react';
// import { api } from '../../../convex/_generated/api';

/** Adapt a map HotspotPin to the full MockHotspot shape used by community components. */
function mapPinToMockHotspot(pin: HotspotPin): MockHotspot {
  return {
    id: pin.id,
    title: pin.title,
    description: '',
    category: pin.category,
    severity: pin.severity,
    status: pin.status,
    address: '',
    lat: pin.lat,
    lng: pin.lng,
    upvotes: pin.upvotes,
    downvotes: 0,
    commentCount: pin.commentCount,
    photoUrls: [],
    authorId: 'unknown',
    createdAt: Date.now(),
    linkedDesignIds: [],
  };
}

/** Adapt a MockHotspot to the HotspotPin shape used by map layers. */
export function mockHotspotToPin(h: MockHotspot): HotspotPin {
  return {
    id: h.id,
    title: h.title,
    category: h.category,
    severity: h.severity,
    status: h.status,
    lat: h.lat,
    lng: h.lng,
    upvotes: h.upvotes,
    commentCount: h.commentCount,
  };
}

interface HotspotFilters {
  category?: HotspotCategory;
  status?: HotspotStatus;
  sort?: 'votes' | 'newest' | 'nearest';
}

/** All community hotspots (merged static mock + user-created local). */
function useMergedMockHotspots(): MockHotspot[] {
  const localHotspots = useLocalHotspotsStore((s) => s.hotspots);
  return useMemo(
    () => [...localHotspots, ...COMMUNITY_MOCK_HOTSPOTS],
    [localHotspots],
  );
}

/** Hotspot list with filtering. Uses mock data when Convex is unavailable. */
export function useHotspotsList(filters?: HotspotFilters) {
  const allHotspots = useMergedMockHotspots();

  const filtered = useMemo(() => {
    let items = [...allHotspots];

    if (filters?.category) {
      items = items.filter((h) => h.category === filters.category);
    }
    if (filters?.status) {
      items = items.filter((h) => h.status === filters.status);
    }

    switch (filters?.sort) {
      case 'newest':
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'nearest':
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'votes':
      default:
        items.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
        break;
    }

    return items;
  }, [allHotspots, filters?.category, filters?.status, filters?.sort]);

  return { hotspots: filtered, isLoading: false };
}

/** Single hotspot by ID. Searches both community and map mock data. */
export function useHotspotById(id: string | undefined) {
  const allHotspots = useMergedMockHotspots();

  const hotspot = useMemo(() => {
    if (!id) return null;
    // Check community mock data first (has full shape)
    const community = allHotspots.find((h) => h.id === id);
    if (community) return community;
    // Fall back to map mock data (converted to full shape)
    const mapPin = MAP_MOCK_HOTSPOTS.find((h) => h.id === id);
    if (mapPin) return mapPinToMockHotspot(mapPin);
    return null;
  }, [id, allHotspots]);

  return { hotspot, isLoading: false };
}

/** Hotspot pins for map rendering within bounds. Merges all data sources. */
export function useHotspotsByBounds(bounds?: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}) {
  const localHotspots = useLocalHotspotsStore((s) => s.hotspots);

  const pins = useMemo(() => {
    // Combine map mock pins with local user-created hotspots converted to pins
    const allPins: HotspotPin[] = [
      ...MAP_MOCK_HOTSPOTS,
      ...localHotspots.map(mockHotspotToPin),
    ];

    if (!bounds) return allPins;

    return allPins.filter(
      (p) =>
        p.lat >= bounds.minLat &&
        p.lat <= bounds.maxLat &&
        p.lng >= bounds.minLng &&
        p.lng <= bounds.maxLng,
    );
  }, [localHotspots, bounds]);

  return { hotspots: pins, isLoading: false };
}

/** Create a new hotspot. Returns mutation function. */
export function useCreateHotspot() {
  const addHotspot = useLocalHotspotsStore((s) => s.addHotspot);

  const createHotspot = useCallback(
    (data: {
      title: string;
      description: string;
      category: HotspotCategory;
      severity: HotspotSeverity;
      lat: number;
      lng: number;
      address: string;
      photoUrls: string[];
      issueGroup?: IssueGroup;
      issueType?: IssueType;
      isBlocking?: boolean;
    }) => {
      if (convexAvailable) {
        // TODO: Call Convex mutation when backend is connected
        // return useMutation(api.hotspots.create)(data);
      }
      return addHotspot(data);
    },
    [addHotspot],
  );

  return createHotspot;
}

/** Vote on a hotspot. Returns mutation function. */
export function useVoteOnHotspot() {
  const voteLocal = useLocalHotspotsStore((s) => s.voteOnHotspot);

  const vote = useCallback(
    (hotspotId: string, value: 1 | -1) => {
      if (convexAvailable) {
        // TODO: Call Convex mutation when backend is connected
      }
      voteLocal(hotspotId, value);
    },
    [voteLocal],
  );

  return vote;
}
