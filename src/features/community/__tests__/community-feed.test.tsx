import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotspotFeed } from '../HotspotFeed';
import { HotspotCardList } from '../HotspotCardList';
import { HotspotExplorer } from '../HotspotExplorer';
import { useCommunityStore } from '../community-store';
import { useExplorerStore } from '../explorer-store';
import { MOCK_HOTSPOTS } from '../mock-data';
import { mapFixture } from './map-fixture';
import { saveArea } from '../SavedAreas';

const { useHotspotsList } = vi.hoisted(() => ({ useHotspotsList: vi.fn() }));
vi.mock('@/lib/api/use-hotspots', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHotspotsList,
}));
vi.mock('@/lib/api/geocoding', () => ({ searchPlaces: vi.fn() }));
vi.mock('maplibre-gl', async () => ({ default: (await import('./map-fixture')).maplibreFixture }));
const ages = [30_000, 5 * 60_000, 2 * 3_600_000, 5 * 86_400_000, 60 * 86_400_000];
const hotspots = Array.from({ length: 25 }, (_, index) => ({
  ...MOCK_HOTSPOTS[0],
  id: `h${index}`,
  title: `Crossing ${index}`,
  address: index === 1 ? 'Broadway, Denver' : 'Colfax, Denver',
  lat: index === 0 ? 39.74 : 40.4,
  lng: -104.99,
  createdAt: Date.now() - ages[index % ages.length],
}));
const storage = new Map<string, string>();

beforeEach(() => {
  useCommunityStore.setState(useCommunityStore.getInitialState());
  useExplorerStore.setState(useExplorerStore.getInitialState());
  useHotspotsList.mockReset().mockReturnValue({ hotspots, isLoading: false });
  mapFixture.reset();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('community feed and card interactions', () => {
  it('pages results, selects a report, and filters title or address with retained category and status controls', () => {
    const select = vi.fn(),
      create = vi.fn();
    render(<HotspotFeed onSelectHotspot={select} onCreateReport={create} />);
    expect(screen.getByText('25 hotspots found')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(10);
    for (const age of ['just now', '5m ago', '2h ago', '5d ago', '2mo ago'])
      expect(screen.getAllByText(age)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Load More/ }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: /Report Issue/ }));
    expect(create).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /^Crossing 0 / }));
    expect(select).toHaveBeenCalledWith('h0');
    expect(useCommunityStore.getState().activeHotspotId).toBe('h0');
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'accessibility' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'resolved' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), {
      target: { value: 'newest' },
    });
    expect(useHotspotsList).toHaveBeenLastCalledWith({
      category: 'accessibility',
      status: 'resolved',
      sort: 'newest',
    });
    fireEvent.change(screen.getByPlaceholderText('Search hotspots...'), {
      target: { value: 'BROADWAY' },
    });
    expect(screen.getByText('1 hotspot found')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search hotspots...'), {
      target: { value: 'nothing-matches' },
    });
    expect(screen.getByText('No hotspots match your filters.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), { target: { value: '' } });
    expect(useCommunityStore.getState().feedFilter).toEqual({
      category: undefined,
      status: undefined,
      sort: 'newest',
    });
  });
  it('shows loading without an empty-result claim and supports a feed without optional callbacks', () => {
    useHotspotsList.mockReturnValue({ hotspots: [], isLoading: true });
    const { rerender } = render(<HotspotFeed />);
    expect(screen.getByText('Loading hotspots...')).toBeInTheDocument();
    expect(screen.queryByText(/No hotspots/)).not.toBeInTheDocument();
    useHotspotsList.mockReturnValue({ hotspots: [hotspots[0]], isLoading: false });
    rerender(<HotspotFeed />);
    fireEvent.click(screen.getByRole('button', { name: /^Crossing 0 / }));
    expect(useCommunityStore.getState().activeHotspotId).toBe('h0');
  });
  it('cross-highlights hovered cards, scrolls map selections, and expires the selection after three seconds', () => {
    vi.useFakeTimers();
    const select = vi.fn();
    const { unmount } = render(
      <HotspotCardList hotspots={hotspots.slice(0, 5)} onSelectHotspot={select} />,
    );
    const card = screen.getByRole('button', { name: /^Crossing 0 / });
    fireEvent.mouseEnter(card);
    expect(useCommunityStore.getState().hoveredHotspotId).toBe('h0');
    expect(card).toHaveClass('bg-blue-50');
    fireEvent.mouseLeave(card);
    expect(useCommunityStore.getState().hoveredHotspotId).toBeNull();
    fireEvent.click(card);
    expect(select).toHaveBeenCalledWith('h0');
    act(() => useCommunityStore.getState().setSelectedHotspot('h0'));
    expect(card.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(card).toHaveClass('ring-2');
    act(() => vi.advanceTimersByTime(2000));
    act(() => useCommunityStore.getState().setSelectedHotspot('h1'));
    act(() => vi.advanceTimersByTime(2000));
    expect(useCommunityStore.getState().selectedHotspotId).toBe('h1');
    act(() => vi.advanceTimersByTime(1000));
    expect(useCommunityStore.getState().selectedHotspotId).toBeNull();
    act(() => useCommunityStore.getState().setSelectedHotspot('not-in-view'));
    unmount();
    act(() => vi.advanceTimersByTime(3000));
    expect(useCommunityStore.getState().selectedHotspotId).toBe('not-in-view');
  });
});

describe('map and feed explorer integration', () => {
  it('searches a moved viewport, links card and pin selection, and clears a spatial search', () => {
    const select = vi.fn();
    render(<HotspotExplorer onSelectHotspot={select} />);
    expect(screen.getAllByText('Showing 20 of 25 hotspots')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /Load More/ })[0]);
    expect(screen.getAllByText('Showing 25 of 25 hotspots')).toHaveLength(2);
    const map = mapFixture.maps[0];
    act(() => map.emit('moveend'));
    fireEvent.click(screen.getByRole('button', { name: 'Search this area' }));
    expect(screen.getAllByText('Showing 1 of 1 hotspot')).toHaveLength(2);
    fireEvent.mouseEnter(screen.getAllByRole('button', { name: /^Crossing 0 / })[0]);
    expect(useCommunityStore.getState().hoveredHotspotId).toBe('h0');
    const marker = mapFixture.markers.at(-1)!;
    fireEvent.mouseEnter(marker.element);
    fireEvent.mouseLeave(marker.element);
    fireEvent.click(marker.element);
    expect(useCommunityStore.getState().selectedHotspotId).toBe('h0');
    fireEvent.click(screen.getAllByRole('button', { name: /^Crossing 0 / })[0]);
    expect(select).toHaveBeenCalledWith('h0');
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear all' })[0]);
    expect(useExplorerStore.getState().boundsFilter).toBeNull();
    fireEvent.change(screen.getAllByPlaceholderText('Search hotspots...')[0], {
      target: { value: 'Broadway' },
    });
    expect(screen.getAllByText('Showing 1 of 1 hotspot')).toHaveLength(2);
    fireEvent.change(screen.getAllByPlaceholderText('Search hotspots...')[0], {
      target: { value: 'absent' },
    });
    expect(screen.getAllByText('No hotspots match your filters.')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('button', { name: 'Close map' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));
    expect(screen.queryByRole('button', { name: 'Close map' })).not.toBeInTheDocument();
  }, 15_000);
  it('draws, saves, reapplies, and clears a polygon through visible controls', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('School crossing');
    render(<HotspotExplorer />);
    const map = mapFixture.maps[0];
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    for (const [lng, lat] of [
      [-105, 39.7],
      [-104.9, 39.7],
      [-104.9, 39.8],
      [-105, 39.8],
    ])
      act(() => map.emit('click', { lngLat: { lng, lat } }));
    act(() => map.emit('dblclick', { preventDefault: vi.fn() }));
    expect(screen.getAllByText('Showing 1 of 1 hotspot')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Save area' })[0]);
    expect(screen.getAllByRole('button', { name: 'School crossing✕' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(useExplorerStore.getState().polygonFilter).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'School crossing✕' })[0]);
    expect(useExplorerStore.getState().polygonFilter).toHaveLength(4);
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear all' })[0]);
    act(() => {
      saveArea({
        name: 'Denver viewport',
        bounds: { minLat: 39.7, maxLat: 39.8, minLng: -105, maxLng: -104.9 },
      });
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Denver viewport✕' })[0]);
    expect(useExplorerStore.getState().boundsFilter).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '×' })[0]);
    expect(useExplorerStore.getState().boundsFilter).toBeNull();
    for (const [label, value] of [
      ['Category', 'accessibility'],
      ['Status', 'open'],
      ['Sort', 'nearest'],
    ])
      fireEvent.change(screen.getAllByRole('combobox', { name: label })[0], { target: { value } });
    expect(useHotspotsList).toHaveBeenLastCalledWith({
      category: 'accessibility',
      status: 'open',
      sort: 'nearest',
    });
    for (const label of ['Category', 'Status'])
      fireEvent.change(screen.getAllByRole('combobox', { name: label })[0], {
        target: { value: '' },
      });
  }, 15_000);
  it('shows source loading without describing it as an empty search', () => {
    useHotspotsList.mockReturnValue({ hotspots: [], isLoading: true });
    render(<HotspotExplorer />);
    expect(screen.getAllByText('Loading hotspots...')).toHaveLength(2);
    expect(screen.queryByText('No hotspots match your filters.')).not.toBeInTheDocument();
  });
});
