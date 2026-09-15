import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  useHotspotsList,
  useHotspotById,
  useHotspotsByBounds,
  useHotspotsListPaginated,
  useCreateHotspot,
  useVoteOnHotspot,
} from '../use-hotspots';
import { useDesignsByBounds } from '../use-designs';
import { useLocalHotspotsStore } from '@/stores/local-hotspots-store';
import { MOCK_HOTSPOTS as community } from '@/features/community/mock-data';
import { MOCK_HOTSPOTS as map, MOCK_DESIGNS as designs } from '@/features/map/mock-data';
vi.mock('../convex-provider', () => ({ convexAvailable: false }));
vi.mock('convex/react', () => ({
  useQuery: () => {
    throw new Error('Offline mode queried Convex');
  },
}));
beforeEach(() => {
  useLocalHotspotsStore.setState(useLocalHotspotsStore.getInitialState());
});
afterEach(cleanup);

it('creates and votes on a local report, then exposes it in list, detail and map views', async () => {
  const { result } = renderHook(() => ({
    create: useCreateHotspot(),
    vote: useVoteOnHotspot(),
    list: useHotspotsList(),
    bounds: useHotspotsByBounds(),
  }));
  const data = {
    title: 'Denver curb ramp',
    description: 'Ramp blocked',
    category: 'accessibility' as const,
    severity: 'high' as const,
    lat: 39.7,
    lng: -104.9,
    address: 'Denver',
    photoUrls: [],
  };
  let id!: string;
  await act(async () => {
    id = await result.current.create(data);
  });
  expect(
    result.current.list.hotspots.some(
      (hotspot) => hotspot.id === id && hotspot.title === data.title,
    ),
  ).toBe(true);
  expect(result.current.bounds.hotspots.find((pin) => pin.id === id)).toMatchObject({
    lat: data.lat,
    lng: data.lng,
    commentCount: 0,
  });
  act(() => {
    void result.current.vote(id, 1);
  });
  expect(result.current.list.hotspots.find((hotspot) => hotspot.id === id)?.upvotes).toBe(1);
  const { result: detail } = renderHook(() => useHotspotById(id));
  expect(detail.current.hotspot?.description).toBe(data.description);
});

it.each([undefined, 'votes', 'newest', 'nearest'] as const)(
  'filters and sorts local %s results while preserving source records',
  (sort) => {
    const local = [
      {
        ...community[0],
        id: 'local-1',
        category: 'accessibility' as const,
        status: 'open' as const,
        createdAt: 100,
        upvotes: 100,
        downvotes: 1,
      },
      {
        ...community[0],
        id: 'local-2',
        category: 'accessibility' as const,
        status: 'open' as const,
        createdAt: 200,
        upvotes: 1,
        downvotes: 0,
      },
      { ...community[0], id: 'local-3', category: 'other' as const, status: 'resolved' as const },
    ];
    useLocalHotspotsStore.setState({ hotspots: local });
    const { result } = renderHook(() =>
      useHotspotsList({ category: 'accessibility', status: 'open', sort }),
    );
    const selected = result.current.hotspots.filter((hotspot) => hotspot.id.startsWith('local-'));
    expect(selected.map((hotspot) => hotspot.id)).toEqual(
      sort === 'newest' || sort === 'nearest' ? ['local-2', 'local-1'] : ['local-1', 'local-2'],
    );
    expect(result.current.isLoading).toBe(false);
    expect(useLocalHotspotsStore.getState().hotspots).toEqual(local);
  },
);

it('supports missing, community, map-only and nonexistent demo IDs', () => {
  const { result, rerender } = renderHook((id: string | undefined) => useHotspotById(id), {
    initialProps: undefined as string | undefined,
  });
  expect(result.current).toEqual({ hotspot: null, isLoading: false });
  rerender(community[0].id);
  expect(result.current.hotspot).toEqual(community[0]);
  const mapOnly = map.find((pin) => !community.some((hotspot) => hotspot.id === pin.id))!;
  rerender(mapOnly.id);
  expect(result.current.hotspot).toMatchObject({
    id: mapOnly.id,
    address: '',
    downvotes: 0,
    linkedDesignIds: [],
  });
  rerender('missing');
  expect(result.current.hotspot).toBeNull();
});

it('includes boundary pins and excludes out-of-bounds hotspots and designs', () => {
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
  expect(result.current.hotspots.hotspots).toEqual(map);
  expect(result.current.designs.designs).toEqual(designs);
  const pin = map[0];
  rerender({ minLat: pin.lat, maxLat: pin.lat, minLng: pin.lng, maxLng: pin.lng });
  expect(result.current.hotspots.hotspots).toContainEqual(pin);
  expect(
    result.current.hotspots.hotspots.every((item) => item.lat === pin.lat && item.lng === pin.lng),
  ).toBe(true);
  const design = designs[0];
  rerender({ minLat: design.lat, maxLat: design.lat, minLng: design.lng, maxLng: design.lng });
  expect(result.current.designs.designs).toContainEqual(design);
  rerender({ minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 });
  expect(result.current.designs.designs).toEqual([]);
  expect(result.current.hotspots.hotspots).toEqual([]);
});

it.each([undefined, 'votes', 'newest', 'nearest'] as const)(
  'loads another local page and resets pagination when %s filters change',
  (sort) => {
    const local = Array.from({ length: 45 }, (_, i) => ({
      ...community[0],
      id: `local-${i}`,
      createdAt: 3_000_000_000_000 + i,
      upvotes: 1000 + i,
      downvotes: i % 2,
      category: 'accessibility' as const,
      status: 'open' as const,
    }));
    useLocalHotspotsStore.setState({ hotspots: local });
    const { result, rerender } = renderHook(
      (filters: Parameters<typeof useHotspotsListPaginated>[0]) =>
        useHotspotsListPaginated(filters),
      {
        initialProps: (sort ? { sort } : undefined) as Parameters<
          typeof useHotspotsListPaginated
        >[0],
      },
    );
    expect(result.current.hotspots).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    expect(result.current.hotspots).toHaveLength(40);
    act(() => result.current.loadMore());
    expect(result.current.hasMore).toBe(false);
    rerender({ sort: 'newest', category: 'accessibility', status: 'open' });
    expect(result.current.hotspots).toHaveLength(20);
    expect(result.current.hotspots[0].id).toBe('local-44');
    expect(result.current.isLoading).toBe(false);
  },
);
