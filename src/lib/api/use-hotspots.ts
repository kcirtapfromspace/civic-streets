import { useMemo, useCallback, useState } from 'react';
import { useQuery, useMutation, useAction, usePaginatedQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { MAX_PHOTO_BYTES, MAX_REPORT_PHOTOS, PHOTO_CONTENT_TYPE } from '../../../shared/photo-upload';
import { convexAvailable } from './convex-provider';
import { MOCK_HOTSPOTS as COMMUNITY_MOCK_HOTSPOTS } from '@/features/community/mock-data';
import { MOCK_HOTSPOTS as MAP_MOCK_HOTSPOTS } from '@/features/map/mock-data';
import { useLocalHotspotsStore } from '@/stores/local-hotspots-store';
import type { MockHotspot } from '@/features/community/mock-data';
import type { HotspotPin, HotspotCategory, HotspotSeverity, HotspotStatus, IssueGroup, IssueType } from '@/lib/types/community';
import type { PhotoExifData } from '../images/process-image';

type PublicHotspot = FunctionReturnType<typeof api.hotspots.list>['page'][number];
const DEMO_CREATED_AT = Date.now();
const SESSION_KEY = 'curbwise-session';
function getSessionToken(): string {
  try { return localStorage.getItem(SESSION_KEY) ?? ''; } catch { return ''; }
}

function preparedPhotos(images: Array<{ blob: Blob }> = []) {
  if (images.length > MAX_REPORT_PHOTOS) {
    throw new Error('A report can include up to three photos.');
  }
  for (const image of images) {
    if (image.blob.size === 0 || image.blob.size > MAX_PHOTO_BYTES || image.blob.type !== PHOTO_CONTENT_TYPE) {
      throw new Error('A photo could not be prepared. Please add it again.');
    }
  }
  return images;
}

// ── Shape adapters ──────────────────────────────────────────────────────

/** Adapt a Convex hotspot doc to MockHotspot shape (used by all UI components). */
function convexDocToMockHotspot(doc: PublicHotspot): MockHotspot {
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
    createdAt: doc.createdAt ?? doc._creationTime ?? 0,
    linkedDesignIds: doc.designId ? [doc.designId] : [],
    issueGroup: doc.issueGroup as IssueGroup | undefined,
    issueType: doc.issueType,
    isBlocking: doc.isBlocking,
  };
}

function convexDocToPin(doc: PublicHotspot): HotspotPin {
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

function sortHotspots(items: MockHotspot[], sort: HotspotFilters['sort']) {
  return [...items].sort((a, b) =>
    sort === 'newest' || sort === 'nearest'
      ? b.createdAt - a.createdAt
      : (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes),
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CONVEX IMPLEMENTATIONS — used when VITE_CONVEX_URL is set
// ══════════════════════════════════════════════════════════════════════════

function useHotspotsListConvex(filters?: HotspotFilters) {
  const { category, status, sort } = filters ?? {};

  const queryArgs = useMemo(() => {
    const args: FunctionArgs<typeof api.hotspots.list> = {
      paginationOpts: { numItems: 200, cursor: null },
    };
    if (category) args.category = category;
    if (status) args.status = status;
    return args;
  }, [category, status]);

  const convexResult = useQuery(api.hotspots.list, queryArgs);

  const hotspots = sortHotspots(convexResult?.page.map(convexDocToMockHotspot) ?? [], sort);

  return { hotspots, isLoading: convexResult === undefined };
}

function useHotspotByIdConvex(id: string | undefined) {
  // Reject legacy demo IDs without reading example records in a connected app.
  const isConvexId = !!id && id.length > 10;

  const convexDoc = useQuery(
    api.hotspots.getById,
    isConvexId ? { hotspotId: id as Id<'hotspots'> } : 'skip',
  );

  const hotspot = useMemo(() => {
    if (!id) return null;
    return isConvexId && convexDoc ? convexDocToMockHotspot(convexDoc) : null;
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
  const uploadPhoto = useAction(api.storage.uploadPhoto);

  return useCallback(
    async (data: {
      reportAssistanceId?: Id<'reportAssistance'>;
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
        throw new Error('Your reporting session is still getting ready. Wait a moment and try again.');
      }

      const images = preparedPhotos(data.processedImages);

      // The action validates and owns the received bytes; arbitrary storage IDs
      // and browser-only preview URLs cannot become another user's report photo.
      let photoStorageIds: Id<'_storage'>[] | undefined;

      if (data.processedImages && data.processedImages.length > 0) {
        const uploadResults = await Promise.all(images.map(async (img) => {
          try {
            const storageId = await uploadPhoto({
              sessionToken,
              bytes: await img.blob.arrayBuffer(),
              contentType: img.blob.type,
            });
            if (typeof storageId !== 'string' || !storageId) throw new Error('Missing photo ID');
            return storageId;
          } catch (error) {
            if (error instanceof ConvexError) throw error;
            throw Object.assign(new Error('A photo could not be uploaded. Please try again.'), { cause: error });
          }
        }));
        photoStorageIds = uploadResults;
      }

      // Only send the timing needed for the submission check. Hidden photo GPS,
      // capture time and device fingerprints are not report fields.
      const clientMeta = data.formOpenedAt
        ? { formDurationMs: Math.max(0, Date.now() - data.formOpenedAt) }
        : undefined;

      return createMutation({
        reportAssistanceId: data.reportAssistanceId,
        sessionToken,
        title: data.title,
        description: data.description || data.title,
        category: data.category,
        severity: data.severity,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        // New reports only use server-owned uploads. Legacy reports still read
        // their existing URLs, but callers cannot add arbitrary external URLs.
        photoUrls: [],
        photoStorageIds,
        issueGroup: data.issueGroup,
        issueType: data.issueType,
        isBlocking: data.isBlocking,
        clientMeta,
        honeypot: data.honeypotValue,
      });
    },
    [createMutation, uploadPhoto],
  );
}

function useVoteOnHotspotConvex() {
  const voteMutation = useMutation(api.hotspots.vote);

  return useCallback(
    async (hotspotId: string, value: 1 | -1) => {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('Your voting session is still getting ready. Wait a moment and try again.');
      }
      // Demo IDs cannot receive community votes.
      if (hotspotId.length <= 10) throw new Error('Only published reports can receive community votes.');
      return voteMutation({
        sessionToken,
        hotspotId: hotspotId as Id<'hotspots'>,
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
  const { category, status, sort } = filters ?? {};
  const allHotspots = useMergedMockHotspots();

  const filtered = useMemo(() => {
    let items = [...allHotspots];
    if (category) items = items.filter((h) => h.category === category);
    if (status) items = items.filter((h) => h.status === status);

    return sortHotspots(items, sort);
  }, [allHotspots, category, status, sort]);

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
      authorId: 'unknown', createdAt: DEMO_CREATED_AT, linkedDesignIds: [],
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
    async (data: {
      title: string; description: string;
      category: HotspotCategory; severity: HotspotSeverity;
      lat: number; lng: number; address: string; photoUrls?: string[];
      issueGroup?: IssueGroup; issueType?: IssueType; isBlocking?: boolean;
      processedImages?: Array<{ blob: Blob; exif: PhotoExifData | null }>;
    }) => {
      // The form owns and revokes its preview URLs. Keep independent image bytes
      // in browser memory so opening a locally saved report still shows photos.
      const photoUrls = await Promise.all(preparedPhotos(data.processedImages).map(({ blob }) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reader.onabort = () => reject(new Error('A photo could not be saved in this browser session. Please try again.'));
          reader.readAsDataURL(blob);
        }),
      ));
      return addHotspot({ ...data, photoUrls });
    },
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
  const { category, status, sort } = filters ?? {};

  const queryArgs = useMemo(() => {
    const args: Omit<FunctionArgs<typeof api.hotspots.list>, 'paginationOpts'> = {};
    if (category) args.category = category;
    if (status) args.status = status;
    return args;
  }, [category, status]);

  const { results, status: paginationStatus, loadMore } = usePaginatedQuery(
    api.hotspots.list,
    queryArgs,
    { initialNumItems: PAGE_SIZE },
  );

  const hotspots = sortHotspots(results.map(convexDocToMockHotspot), sort);

  return {
    hotspots,
    isLoading: paginationStatus === 'LoadingFirstPage',
    hasMore: paginationStatus === 'CanLoadMore',
    loadMore: () => loadMore(PAGE_SIZE),
  };
}

function useHotspotsListPaginatedMock(filters?: HotspotFilters) {
  const { category, status, sort } = filters ?? {};
  const allHotspots = useMergedMockHotspots();
  const filterKey = `${category}-${status}-${sort}`;
  const [pagination, setPagination] = useState({ filterKey, page: 1 });
  if (pagination.filterKey !== filterKey) {
    setPagination({ filterKey, page: 1 });
  }
  const page = pagination.page;

  const filtered = useMemo(() => {
    let items = [...allHotspots];
    if (category) items = items.filter((h) => h.category === category);
    if (status) items = items.filter((h) => h.status === status);

    return sortHotspots(items, sort);
  }, [allHotspots, category, status, sort]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  return {
    hotspots: paginated,
    isLoading: false,
    hasMore: paginated.length < filtered.length,
    loadMore: () => setPagination((previous) => ({ ...previous, page: previous.page + 1 })),
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
