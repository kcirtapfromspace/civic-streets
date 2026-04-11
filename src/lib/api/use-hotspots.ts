import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, usePaginatedQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { convexAvailable } from './convex-provider';
import { MOCK_HOTSPOTS as COMMUNITY_MOCK_HOTSPOTS } from '@/features/community/mock-data';
import { MOCK_HOTSPOTS as MAP_MOCK_HOTSPOTS } from '@/features/map/mock-data';
import { useLocalHotspotsStore } from '@/stores/local-hotspots-store';
import { collectClientMeta } from './fingerprint';
import type { MockHotspot } from '@/features/community/mock-data';
import type { HotspotPin, HotspotCategory, HotspotSeverity, HotspotStatus, IssueGroup, IssueType } from '@/lib/types/community';
import { computeLocationVerification } from '../images/process-image';
import type { PhotoExifData, ProcessedImage } from '../images/process-image';

const SESSION_KEY = 'curbwise-session';
function getSessionToken(): string {
  try { return localStorage.getItem(SESSION_KEY) ?? ''; } catch { return ''; }
}

// ── Shape adapters ──────────────────────────────────────────────────────

/** Adapt a Convex hotspot doc to MockHotspot shape (used by all UI components). */
function convexDocToMockHotspot(doc: Record<string, any>): MockHotspot {
  return {
    id: doc._id,
    title: doc.title,
    description: doc.description ?? '',
    category: doc.category as HotspotCategory,
    severity: doc.severity as HotspotSeverity,
    status: (doc.status ?? 'open') as HotspotStatus,
    address: doc.address ?? '',
    lat: doc.lat,
    lng: doc.lng,
    upvotes: doc.upvotes ?? 0,
    downvotes: 0,
    commentCount: doc.commentCount ?? 0,
    photoUrls: doc.photoUrls ?? [],
    authorId: doc.userId ?? 'unknown',
    createdAt: doc.createdAt ?? doc._creationTime ?? Date.now(),
    linkedDesignIds: doc.designId ? [doc.designId] : [],
  };
}

function convexDocToPin(doc: Record<string, any>): HotspotPin {
  return {
    id: doc._id,
    title: doc.title,
    category: doc.category as HotspotCategory,
    severity: doc.severity as HotspotSeverity,
    status: (doc.status ?? 'open') as HotspotStatus,
    lat: doc.lat,
    lng: doc.lng,
    upvotes: doc.upvotes ?? 0,
    commentCount: doc.commentCount ?? 0,
  };
}

/** Adapt a MockHotspot to HotspotPin shape used by map layers. */
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

// ── Filter interface ────────────────────────────────────────────────────

interface HotspotFilters {
  category?: HotspotCategory;
  status?: HotspotStatus;
  sort?: 'votes' | 'newest' | 'nearest';
}

// ══════════════════════════════════════════════════════════════════════════
// CONVEX IMPLEMENTATIONS — used when VITE_CONVEX_URL is set
// ══════════════════════════════════════════════════════════════════════════

function useHotspotsListConvex(filters?: HotspotFilters) {
  const category = filters?.category;
  const status = filters?.status;

  const queryArgs = useMemo(() => {
    const args: Record<string, unknown> = {
      paginationOpts: { numItems: 200, cursor: null },
    };
    if (category) args.category = category;
    if (status) args.status = status;
    return args;
  }, [category, status]);

  const convexResult = useQuery(api.hotspots.list, queryArgs as any);

  const hotspots = useMemo(() => {
    if (!convexResult) return []; // loading
    let items = convexResult.page.map(convexDocToMockHotspot);

    switch (filters?.sort) {
      case 'newest':
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'nearest':
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'votes':
      default:
        items.sort((a, b) => b.upvotes - a.upvotes);
        break;
    }
    return items;
  }, [convexResult, filters?.sort]);

  return { hotspots, isLoading: convexResult === undefined };
}

function useHotspotByIdConvex(id: string | undefined) {
  // Convex IDs are longer strings; mock IDs are short like "h1"
  const isConvexId = !!id && id.length > 10;

  const convexDoc = useQuery(
    api.hotspots.getById,
    isConvexId ? { hotspotId: id as any } : 'skip',
  );

  const hotspot = useMemo(() => {
    if (!id) return null;
    if (isConvexId) {
      return convexDoc ? convexDocToMockHotspot(convexDoc) : null;
    }
    // Fall back to mock data for legacy IDs
    const mock = COMMUNITY_MOCK_HOTSPOTS.find((h) => h.id === id);
    if (mock) return mock;
    const mapPin = MAP_MOCK_HOTSPOTS.find((h) => h.id === id);
    if (mapPin) return {
      id: mapPin.id, title: mapPin.title, description: '',
      category: mapPin.category, severity: mapPin.severity, status: mapPin.status,
      address: '', lat: mapPin.lat, lng: mapPin.lng, upvotes: mapPin.upvotes,
      downvotes: 0, commentCount: mapPin.commentCount, photoUrls: [],
      authorId: 'unknown', createdAt: Date.now(), linkedDesignIds: [],
    } as MockHotspot;
    return null;
  }, [id, isConvexId, convexDoc]);

  return { hotspot, isLoading: isConvexId && convexDoc === undefined };
}

function useHotspotsByBoundsConvex(bounds?: {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}) {
  // When no bounds specified, use a world-encompassing bounds to fetch all
  const queryBounds = bounds ?? { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
  const convexDocs = useQuery(api.hotspots.getByBounds, queryBounds);

  const pins = useMemo(() => {
    const convexPins: HotspotPin[] = convexDocs
      ? convexDocs.map(convexDocToPin)
      : [];
    return convexPins;
  }, [convexDocs]);

  return { hotspots: pins, isLoading: convexDocs === undefined };
}

function useCreateHotspotConvex() {
  const createMutation = useMutation(api.hotspots.create);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  return useCallback(
    async (data: {
      title: string;
      description: string;
      category: HotspotCategory;
      severity: HotspotSeverity;
      lat: number;
      lng: number;
      address: string;
      photoUrls?: string[];
      issueGroup?: IssueGroup;
      issueType?: IssueType;
      isBlocking?: boolean;
      processedImages?: Array<{ blob: Blob; exif: PhotoExifData | null }>;
      honeypotValue?: string;
      formOpenedAt?: number;
    }) => {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        console.error('[useCreateHotspot] No session token');
        return;
      }

      // Upload compressed images to Convex storage
      let photoStorageIds: string[] | undefined;
      let photoExifData: PhotoExifData[] | undefined;

      if (data.processedImages && data.processedImages.length > 0) {
        const uploadResults = await Promise.all(
          data.processedImages.map(async (img) => {
            const uploadUrl = await generateUploadUrl();
            const result = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': img.blob.type || 'image/jpeg' },
              body: img.blob,
            });
            const { storageId } = await result.json();
            return storageId;
          })
        );
        photoStorageIds = uploadResults;
        photoExifData = data.processedImages
          .map((img) => img.exif)
          .filter((e): e is PhotoExifData => e !== null);
      }

      // Compute location verification from EXIF GPS vs reported lat/lng
      let locationVerification: { photoHasGps: boolean; distanceMeters?: number; status: string } | undefined;
      if (photoExifData && photoExifData.length > 0) {
        locationVerification = computeLocationVerification(data.lat, data.lng, photoExifData);
      }

      // Collect client metadata
      const clientMeta = data.formOpenedAt ? collectClientMeta(data.formOpenedAt) : undefined;

      return createMutation({
        sessionToken,
        title: data.title,
        description: data.description || data.title,
        category: data.category,
        severity: data.severity,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        photoUrls: data.photoUrls,
        photoStorageIds: photoStorageIds as any,
        photoExifData,
        locationVerification,
        issueGroup: data.issueGroup,
        issueType: data.issueType,
        isBlocking: data.isBlocking,
        clientMeta,
        honeypot: data.honeypotValue,
      });
    },
    [createMutation, generateUploadUrl],
  );
}

function useVoteOnHotspotConvex() {
  const voteMutation = useMutation(api.hotspots.vote);

  return useCallback(
    async (hotspotId: string, value: 1 | -1) => {
      const sessionToken = getSessionToken();
      if (!sessionToken) return;
      // Only vote on Convex hotspots (long IDs)
      if (hotspotId.length <= 10) return;
      return voteMutation({
        sessionToken,
        hotspotId: hotspotId as any,
        value,
      });
    },
    [voteMutation],
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MOCK IMPLEMENTATIONS — used when no Convex backend
// ══════════════════════════════════════════════════════════════════════════

function useMergedMockHotspots(): MockHotspot[] {
  const localHotspots = useLocalHotspotsStore((s) => s.hotspots);
  return useMemo(
    () => [...localHotspots, ...COMMUNITY_MOCK_HOTSPOTS],
    [localHotspots],
  );
}

function useHotspotsListMock(filters?: HotspotFilters) {
  const allHotspots = useMergedMockHotspots();

  const filtered = useMemo(() => {
    let items = [...allHotspots];
    if (filters?.category) items = items.filter((h) => h.category === filters.category);
    if (filters?.status) items = items.filter((h) => h.status === filters.status);

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

function useHotspotByIdMock(id: string | undefined) {
  const allHotspots = useMergedMockHotspots();

  const hotspot = useMemo(() => {
    if (!id) return null;
    const community = allHotspots.find((h) => h.id === id);
    if (community) return community;
    const mapPin = MAP_MOCK_HOTSPOTS.find((h) => h.id === id);
    if (mapPin) return {
      id: mapPin.id, title: mapPin.title, description: '',
      category: mapPin.category, severity: mapPin.severity, status: mapPin.status,
      address: '', lat: mapPin.lat, lng: mapPin.lng, upvotes: mapPin.upvotes,
      downvotes: 0, commentCount: mapPin.commentCount, photoUrls: [],
      authorId: 'unknown', createdAt: Date.now(), linkedDesignIds: [],
    } as MockHotspot;
    return null;
  }, [id, allHotspots]);

  return { hotspot, isLoading: false };
}

function useHotspotsByBoundsMock(bounds?: {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}) {
  const localHotspots = useLocalHotspotsStore((s) => s.hotspots);

  const pins = useMemo(() => {
    const allPins: HotspotPin[] = [
      ...MAP_MOCK_HOTSPOTS,
      ...localHotspots.map(mockHotspotToPin),
    ];
    if (!bounds) return allPins;
    return allPins.filter(
      (p) => p.lat >= bounds.minLat && p.lat <= bounds.maxLat &&
             p.lng >= bounds.minLng && p.lng <= bounds.maxLng,
    );
  }, [localHotspots, bounds]);

  return { hotspots: pins, isLoading: false };
}

function useCreateHotspotMock() {
  const addHotspot = useLocalHotspotsStore((s) => s.addHotspot);
  return useCallback(
    (data: {
      title: string; description: string;
      category: HotspotCategory; severity: HotspotSeverity;
      lat: number; lng: number; address: string; photoUrls: string[];
      issueGroup?: IssueGroup; issueType?: IssueType; isBlocking?: boolean;
    }) => addHotspot(data),
    [addHotspot],
  );
}

function useVoteOnHotspotMock() {
  const voteLocal = useLocalHotspotsStore((s) => s.voteOnHotspot);
  return useCallback(
    (hotspotId: string, value: 1 | -1) => voteLocal(hotspotId, value),
    [voteLocal],
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PAGINATED HOOK IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 20;

function useHotspotsListPaginatedConvex(filters?: HotspotFilters) {
  const category = filters?.category;
  const status = filters?.status;

  const queryArgs = useMemo(() => {
    const args: Record<string, unknown> = {};
    if (category) args.category = category;
    if (status) args.status = status;
    return args;
  }, [category, status]);

  const { results, status: paginationStatus, loadMore } = usePaginatedQuery(
    api.hotspots.list,
    queryArgs as any,
    { initialNumItems: PAGE_SIZE },
  );

  const hotspots = useMemo(() => {
    let items = results.map(convexDocToMockHotspot);

    switch (filters?.sort) {
      case 'newest':
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'nearest':
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'votes':
      default:
        items.sort((a, b) => b.upvotes - a.upvotes);
        break;
    }
    return items;
  }, [results, filters?.sort]);

  return {
    hotspots,
    isLoading: paginationStatus === 'LoadingFirstPage',
    hasMore: paginationStatus === 'CanLoadMore',
    loadMore: () => loadMore(PAGE_SIZE),
  };
}

function useHotspotsListPaginatedMock(filters?: HotspotFilters) {
  const allHotspots = useMergedMockHotspots();
  const [page, setPage] = useState(1);

  // Reset page when filters change
  const filterKey = `${filters?.category}-${filters?.status}-${filters?.sort}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      setPage(1);
      prevFilterKey.current = filterKey;
    }
  }, [filterKey]);

  const filtered = useMemo(() => {
    let items = [...allHotspots];
    if (filters?.category) items = items.filter((h) => h.category === filters.category);
    if (filters?.status) items = items.filter((h) => h.status === filters.status);

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

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  return {
    hotspots: paginated,
    isLoading: false,
    hasMore: paginated.length < filtered.length,
    loadMore: () => setPage((p) => p + 1),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORTS — select implementation based on convexAvailable
// ══════════════════════════════════════════════════════════════════════════

export const useHotspotsList = convexAvailable ? useHotspotsListConvex : useHotspotsListMock;
export const useHotspotById = convexAvailable ? useHotspotByIdConvex : useHotspotByIdMock;
export const useHotspotsByBounds = convexAvailable ? useHotspotsByBoundsConvex : useHotspotsByBoundsMock;
export const useCreateHotspot = convexAvailable ? useCreateHotspotConvex : useCreateHotspotMock;
export const useVoteOnHotspot = convexAvailable ? useVoteOnHotspotConvex : useVoteOnHotspotMock;
export const useHotspotsListPaginated = convexAvailable ? useHotspotsListPaginatedConvex : useHotspotsListPaginatedMock;
