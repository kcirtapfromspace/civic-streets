import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerMinimap } from '../ExplorerMinimap';
import { clearPlaceSearchCache } from '@/lib/api/use-submitted-place-search';

const { searchPlaces, map } = vi.hoisted(() => ({
  searchPlaces: vi.fn(),
  map: {
    addControl: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    isStyleLoaded: () => true,
    flyTo: vi.fn(),
    getBounds: vi.fn(() => ({
      getSouth: () => 39.7,
      getNorth: () => 39.8,
      getWest: () => -105,
      getEast: () => -104.9,
    })),
  },
}));
vi.mock('@/lib/api/geocoding', () => ({ searchPlaces }));
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(function () {
      return map;
    }),
    NavigationControl: vi.fn(function () {
      return {};
    }),
  },
}));

describe('community map submitted search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPlaceSearchCache();
  });
  afterEach(cleanup);

  it('stops reporting map bounds when the parent disconnects its area filter', () => {
    const onBoundsChange = vi.fn();
    const view = render(<ExplorerMinimap hotspots={[]} onBoundsChange={onBoundsChange} />);
    const moveEnd = map.on.mock.calls.find(([event]) => event === 'moveend')![1];
    moveEnd();
    expect(onBoundsChange).toHaveBeenCalledWith({
      minLat: 39.7, maxLat: 39.8, minLng: -105, maxLng: -104.9,
    });

    view.rerender(<ExplorerMinimap hotspots={[]} />);
    expect(() => moveEnd()).not.toThrow();
    expect(onBoundsChange).toHaveBeenCalledTimes(1);
    expect(map.getBounds).toHaveBeenCalledTimes(1);
  });

  it('waits for explicit submission and moves the map only when a result is selected', async () => {
    searchPlaces.mockResolvedValue([
      { place_id: 1, display_name: 'Denver, Colorado', lat: '39.7392', lon: '-104.9903' },
    ]);
    render(<ExplorerMinimap hotspots={[]} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search places on community map' }), {
      target: { value: 'Denver' },
    });
    expect(searchPlaces).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const place = await screen.findByRole('button', { name: 'Denver, Colorado' });
    expect(map.flyTo).not.toHaveBeenCalled();
    fireEvent.click(place);
    expect(map.flyTo).toHaveBeenCalledWith({
      center: [-104.9903, 39.7392],
      zoom: 15,
      duration: 800,
    });
    expect(
      screen.queryByText('No places found. Try a more specific address or city.'),
    ).not.toBeInTheDocument();
  });

  it('distinguishes a proxy error from a successful search with no matches', async () => {
    searchPlaces
      .mockRejectedValueOnce(new Error('Place search is not configured yet.'))
      .mockResolvedValueOnce([]);
    render(<ExplorerMinimap hotspots={[]} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Denver' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Place search is not configured yet.',
    );
    expect(screen.queryByText(/No places found/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('status')).toHaveTextContent('No places found');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reopens dismissed suggestions on focus and clears the query without searching or moving the map', async () => {
    searchPlaces.mockResolvedValue([
      { place_id: 1, display_name: 'Denver, Colorado', lat: '39.7392', lon: '-104.9903' },
    ]);
    render(<ExplorerMinimap hotspots={[]} />);
    const input = screen.getByRole('textbox', { name: 'Search places on community map' });
    fireEvent.focus(input);
    expect(searchPlaces).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Denver' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('button', { name: 'Denver, Colorado' })).toBeVisible();

    fireEvent.click(document.body);
    expect(screen.queryByRole('button', { name: 'Denver, Colorado' })).not.toBeInTheDocument();
    expect(input).toHaveValue('Denver');
    fireEvent.focus(input);
    expect(screen.getByRole('button', { name: 'Denver, Colorado' })).toBeVisible();
    expect(searchPlaces).toHaveBeenCalledTimes(1);
    expect(map.flyTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear place search' }));
    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear place search' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Denver, Colorado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    fireEvent.focus(input);
    expect(screen.queryByRole('button', { name: 'Denver, Colorado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(searchPlaces).toHaveBeenCalledTimes(1);
    expect(map.flyTo).not.toHaveBeenCalled();
  });
});
