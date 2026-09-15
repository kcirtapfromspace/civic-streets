import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import {
  useHotspotsList,
  useHotspotById,
  useHotspotsByBounds,
  useHotspotsListPaginated,
  useVoteOnHotspot,
} from '../use-hotspots';
import { useDesignsByBounds } from '../use-designs';
import { MOCK_HOTSPOTS as community } from '@/features/community/mock-data';
import { MOCK_HOTSPOTS as map } from '@/features/map/mock-data';

const port = vi.hoisted(() => ({
  raw: undefined as unknown,
  query: vi.fn(),
  paginate: vi.fn(),
  mutation: vi.fn(),
  loadMore: vi.fn(),
  results: [] as unknown[],
  status: 'LoadingFirstPage',
}));
vi.mock('../convex-provider', () => ({ convexAvailable: true }));
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => {
    port.query(...args);
    return port.raw;
  },
  useMutation: () => port.mutation,
  useAction: vi.fn(),
  usePaginatedQuery: (...args: unknown[]) => {
    port.paginate(...args);
    return { results: port.results, status: port.status, loadMore: port.loadMore };
  },
}));
const old = {
  _id: 'old-hotspot-identifier',
  title: 'Older with support',
  category: 'accessibility',
  severity: 'high',
  lat: 39.7,
  lng: -104.9,
  upvotes: 10,
  createdAt: 100,
};
const recent = {
  ...old,
  _id: 'recent-hotspot-identifier',
  title: 'Recent',
  upvotes: 1,
  createdAt: 200,
  status: 'resolved',
  description: 'Fixed',
  address: 'Denver',
  commentCount: 3,
  photoUrls: ['https://photo.example'],
  userId: 'author',
  designId: 'design',
};
beforeEach(() => {
  vi.clearAllMocks();
  port.raw = undefined;
  port.results = [];
  port.status = 'LoadingFirstPage';
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(cleanup);

it.each([undefined, 'votes', 'newest', 'nearest'] as const)(
  'sorts backend hotspot results by %s without changing the subscription data',
  (sort) => {
    const { result, rerender } = renderHook(() =>
      useHotspotsList({ category: 'accessibility', status: 'open', sort }),
    );
    expect(result.current).toEqual({ hotspots: [], isLoading: true });
    expect(port.query.mock.lastCall?.[1]).toEqual({
      paginationOpts: { numItems: 200, cursor: null },
      category: 'accessibility',
      status: 'open',
    });
    const page = [old, recent];
    port.raw = { page };
    rerender();
    expect(result.current.hotspots.map((item) => item.id)).toEqual(
      sort === 'newest' || sort === 'nearest' ? [recent._id, old._id] : [old._id, recent._id],
    );
    expect(page).toEqual([old, recent]);
    expect(result.current.hotspots.find((item) => item.id === old._id)).toMatchObject({
      status: 'open',
      description: '',
      address: '',
      downvotes: 0,
      commentCount: 0,
      photoUrls: [],
      authorId: 'unknown',
      linkedDesignIds: [],
    });
    expect(result.current.hotspots.find((item) => item.id === recent._id)).toMatchObject({
      status: 'resolved',
      authorId: 'author',
      linkedDesignIds: ['design'],
    });
  },
);

it('omits unset filters and supports fallback creation times and vote totals', () => {
  port.raw = {
    page: [
      { ...old, createdAt: undefined, upvotes: undefined, _creationTime: 50 },
      { ...recent, createdAt: undefined },
    ],
  };
  const { result } = renderHook(useHotspotsList);
  expect(port.query.mock.lastCall?.[1]).toEqual({
    paginationOpts: { numItems: 200, cursor: null },
  });
  expect(result.current.hotspots.find((item) => item.id === old._id)).toMatchObject({
    createdAt: 50,
    upvotes: 0,
  });
  expect(result.current.hotspots.find((item) => item.id === recent._id)?.createdAt).toBeGreaterThan(
    1000,
  );
});

it('queries real IDs while keeping old demo links readable and missing IDs empty', () => {
  const { result, rerender } = renderHook((id: string | undefined) => useHotspotById(id), {
    initialProps: undefined as string | undefined,
  });
  expect(result.current).toEqual({ hotspot: null, isLoading: false });
  expect(port.query.mock.lastCall?.[1]).toBe('skip');
  rerender(old._id);
  expect(result.current.isLoading).toBe(true);
  expect(port.query.mock.lastCall?.[1]).toEqual({ hotspotId: old._id });
  port.raw = recent;
  rerender(old._id);
  expect(result.current.hotspot?.title).toBe('Recent');
  port.raw = null;
  rerender(old._id);
  expect(result.current).toEqual({ hotspot: null, isLoading: false });
  rerender(community[0].id);
  expect(result.current.hotspot).toEqual(community[0]);
  const mapOnly = map.find((pin) => !community.some((hotspot) => hotspot.id === pin.id))!;
  expect(mapOnly).toBeDefined();
  rerender(mapOnly.id);
  expect(result.current.hotspot).toMatchObject({
    id: mapOnly.id,
    title: mapOnly.title,
    authorId: 'unknown',
    photoUrls: [],
  });
  rerender('missing');
  expect(result.current.hotspot).toBeNull();
});

it('maps only returned pins and passes explicit map bounds to each backend query', () => {
  const { result, rerender } = renderHook(
    (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | undefined) => ({
      hotspots: useHotspotsByBounds(bounds),
      designs: useDesignsByBounds(bounds),
    }),
    {
      initialProps: undefined as
        | { minLat: number; maxLat: number; minLng: number; maxLng: number }
        | undefined,
    },
  );
  expect(result.current.hotspots.isLoading && result.current.designs.isLoading).toBe(true);
  expect(port.query.mock.lastCall?.[1]).toEqual({
    minLat: -90,
    maxLat: 90,
    minLng: -180,
    maxLng: 180,
  });
  const bounds = { minLat: 39, maxLat: 40, minLng: -105, maxLng: -104 };
  port.raw = [
    old,
    {
      ...recent,
      lat: undefined,
      lng: undefined,
      upvotes: undefined,
      prowagPass: true,
      templateId: 'road-diet',
    },
  ];
  rerender(bounds);
  expect(port.query.mock.lastCall?.[1]).toEqual(bounds);
  expect(getFunctionName(port.query.mock.lastCall?.[0])).toBe('designs:getByBounds');
  expect(result.current.hotspots.hotspots[0]).toMatchObject({
    status: 'open',
    commentCount: 0,
    upvotes: 10,
  });
  expect(result.current.designs.designs[1]).toMatchObject({
    lat: 0,
    lng: 0,
    upvotes: 0,
    prowagPass: true,
    templateId: 'road-diet',
  });
  expect(result.current.designs.designs[0].prowagPass).toBe(false);
});

it.each([undefined, 'votes', 'newest', 'nearest'] as const)(
  'keeps paginated %s results sorted and requests 20 more rows',
  (sort) => {
    const { result, rerender } = renderHook(() =>
      useHotspotsListPaginated(
        sort ? { sort, category: 'accessibility', status: 'open' } : undefined,
      ),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasMore).toBe(false);
    expect(port.paginate.mock.lastCall?.slice(1)).toEqual([
      sort ? { category: 'accessibility', status: 'open' } : {},
      { initialNumItems: 20 },
    ]);
    port.results = [old, recent];
    port.status = 'CanLoadMore';
    rerender();
    expect(result.current.hotspots[0].id).toBe(
      sort === 'newest' || sort === 'nearest' ? recent._id : old._id,
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    expect(port.loadMore).toHaveBeenCalledExactlyOnceWith(20);
    port.status = 'Exhausted';
    rerender();
    expect(result.current.hasMore).toBe(false);
  },
);

it('only votes on backend IDs with a readable active session', async () => {
  const { result } = renderHook(useVoteOnHotspot);
  await result.current(old._id, 1);
  expect(port.mutation).not.toHaveBeenCalled();
  localStorage.setItem('curbwise-session', 'session');
  await result.current('h1', 1);
  expect(port.mutation).not.toHaveBeenCalled();
  await result.current(old._id, -1);
  expect(port.mutation).toHaveBeenCalledExactlyOnceWith({
    sessionToken: 'session',
    hotspotId: old._id,
    value: -1,
  });
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('Storage disabled');
    },
  });
  await result.current(old._id, 1);
  expect(port.mutation).toHaveBeenCalledTimes(1);
});
