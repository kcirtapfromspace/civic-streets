import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeMapLocation } from '../initial-location';
import { DEFAULT_MAP_CENTER, useMapStore } from '../map-store';

const payload = { latitude: '40.71', longitude: '-74.01', city: 'New York', region: 'New York', accuracy: 10 };
beforeEach(() => useMapStore.setState(useMapStore.getInitialState()));
afterEach(() => vi.unstubAllGlobals());
it('starts with a usable Denver map, initializes once, and keeps the estimate session-only', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
  expect(useMapStore.getState().center).toEqual(DEFAULT_MAP_CENTER);
  await Promise.all([initializeMapLocation(), initializeMapLocation()]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(useMapStore.getState()).toMatchObject({ center: { lat: 40.71, lng: -74.01 }, zoom: 11, initialLocationStatus: 'located', initialLocationLabel: 'New York, New York', selectedLocation: null });
  await initializeMapLocation();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps Denver on a provider failure and does not retry on each mount', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await initializeMapLocation();
  await initializeMapLocation();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(useMapStore.getState()).toMatchObject({ center: DEFAULT_MAP_CENTER, zoom: 12, initialLocationStatus: 'fallback' });
});
it.each([
  { selectedLocation: { lat: 1, lng: 2, address: 'Chosen street' } },
  { contextMenuPosition: { lat: 1, lng: 2, x: 1, y: 2 } },
  { reportFormOpen: true }, { lockedToLocation: true },
  { center: { ...DEFAULT_MAP_CENTER, lat: 1 } },
  { center: { ...DEFAULT_MAP_CENTER, lng: 2 } }, { zoom: 18 },
])('preserves an existing map intent %#', async (state) => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  useMapStore.setState(state);
  await initializeMapLocation();
  expect(fetcher).not.toHaveBeenCalled();
  expect(useMapStore.getState()).toMatchObject({ ...state, initialLocationStatus: 'skipped' });
});
it.each(['pan', 'zoom', 'search', 'pin', 'report', 'draft'] as const)('a delayed response never overrides %s', async (action) => {
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; })));
  const pending = initializeMapLocation();
  expect(useMapStore.getState().initialLocationStatus).toBe('loading');
  const state = useMapStore.getState();
  if (action === 'pan') state.setCenter({ lat: 1, lng: 2 });
  if (action === 'zoom') state.setZoom(16);
  if (action === 'search') state.setSelectedLocation({ lat: 1, lng: 2, address: 'Chosen' });
  if (action === 'pin') state.openContextMenu({ lat: 1, lng: 2, x: 1, y: 2 });
  if (action === 'report') state.openReportForm({ lat: 1, lng: 2, address: 'Chosen' });
  if (action === 'draft') state.setLockedToLocation(true);
  const chosen = useMapStore.getState();
  finish(new Response(JSON.stringify(payload)));
  await pending;
  expect(useMapStore.getState()).toEqual(chosen);
  expect(chosen.initialLocationStatus).toBe('skipped');
});
it('clearing overlays does not count as picking a starting area', () => {
  const state = useMapStore.getState();
  state.setSelectedLocation(null); state.openContextMenu(null); state.setLockedToLocation(false);
  expect(useMapStore.getState().initialLocationStatus).toBe('idle');
});
