import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MapControls } from '../MapControls';
import { PinDesignFlow } from '../PinDesignFlow';
import { useMapStore } from '../map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useDrawingStore } from '@/stores/drawing-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { MapFake, mouse } from './map-fake';
const services = vi.hoisted(() => ({
  reverse: vi.fn(),
  road: vi.fn(),
  search: vi.fn(),
  results: [] as Array<{ place_id: number; lat: string; lon: string; display_name: string }>,
  loading: false,
  error: null as string | null,
  searched: false,
}));
vi.mock('@/lib/api/geocoding', () => ({ reverseGeocodeLocation: services.reverse }));
vi.mock('@/features/proposal/utils/road-geometry', () => ({ fetchRoadPath: services.road }));
vi.mock('@/features/safety-data/CrashCoverageStatus', () => ({
  CrashCoverageStatus: () => <p>Coverage fixture</p>,
}));
vi.mock('@/lib/api/use-submitted-place-search', async () => {
  const { useState } = await import('react');
  return {
    useSubmittedPlaceSearch: () => {
      const [query, setQuery] = useState('');
      return {
        query,
        setQuery,
        results: services.results,
        isLoading: services.loading,
        error: services.error,
        hasSearched: services.searched,
        search: services.search,
      };
    },
  };
});
beforeEach(() => {
  useMapStore.setState(useMapStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useDrawingStore.setState(useDrawingStore.getInitialState());
  useProposalStore.setState(useProposalStore.getInitialState());
  useSafetyDataStore.setState(useSafetyDataStore.getInitialState());
  services.reverse.mockReset().mockResolvedValue({ display_name: 'Broadway, Denver' });
  services.road.mockReset().mockResolvedValue({
    path: [
      { lat: 39.7, lng: -104.9 },
      { lat: 39.8, lng: -104.9 },
    ],
    bearing: 0,
  });
  services.search.mockReset();
  services.results = [];
  services.loading = false;
  services.error = null;
  services.searched = false;
});
afterEach(cleanup);
it('submits search explicitly, selects a place, dismisses suggestions outside, and clears selection', () => {
  const { rerender } = render(<MapControls map={new MapFake().asMap()} />);
  const input = screen.getByRole('textbox', { name: 'Search places' });
  expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Denver' } });
  expect(services.search).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(services.search).toHaveBeenCalledOnce();
  services.results = [
    { place_id: 1, lat: '39.7', lon: '-104.9', display_name: 'Broadway, Denver' },
  ];
  rerender(<MapControls map={null} />);
  expect(screen.getByRole('link', { name: /OpenStreetMap contributors/ })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  fireEvent.click(document.body);
  expect(screen.queryByRole('button', { name: 'Broadway, Denver' })).not.toBeInTheDocument();
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole('button', { name: 'Broadway, Denver' }));
  expect(useMapStore.getState()).toMatchObject({
    center: { lat: 39.7, lng: -104.9 },
    zoom: 17,
    selectedLocation: { address: 'Broadway, Denver' },
  });
  expect(input).toHaveValue('Broadway, Denver');
  fireEvent.click(screen.getByRole('button', { name: 'Clear place search' }));
  expect(input).toHaveValue('');
  expect(useMapStore.getState().selectedLocation).toBeNull();
});
it('shows loading, empty, and search-error states', () => {
  const { rerender } = render(<MapControls map={null} />);
  fireEvent.focus(screen.getByRole('textbox', { name: 'Search places' }));
  services.loading = true;
  rerender(<MapControls map={null} />);
  expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled();
  services.loading = false;
  services.searched = true;
  rerender(<MapControls map={null} />);
  expect(screen.getByRole('status')).toHaveTextContent('No places matched');
  services.error = 'Please wait before searching again';
  rerender(<MapControls map={null} />);
  expect(screen.getByRole('alert')).toHaveTextContent(services.error);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('changes view modes and controls community and crash overlays independently', () => {
  render(<MapControls map={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Earth' }));
  fireEvent.click(screen.getByRole('button', { name: 'Earth' }));
  expect(useMapStore.getState().is3D).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Satellite' }));
  expect(useMapStore.getState()).toMatchObject({ is3D: false, mapType: 'satellite' });
  fireEvent.click(screen.getByRole('button', { name: 'Map' }));
  expect(useMapStore.getState().mapType).toBe('roadmap');
  fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
  fireEvent.click(screen.getByLabelText('Community Hotspots'));
  fireEvent.click(screen.getByLabelText('Community Designs'));
  fireEvent.click(screen.getByLabelText('Service Areas'));
  fireEvent.click(screen.getByLabelText('Heatmap', { exact: true }));
  expect(useMapStore.getState()).toMatchObject({
    showHotspots: false,
    showDesigns: false,
    showServiceAreas: true,
    showHeatmap: true,
  });
  fireEvent.click(screen.getByLabelText('Crash Heatmap'));
  expect(screen.getByText('Coverage fixture')).toBeInTheDocument();
  fireEvent.click(screen.getAllByLabelText('Heatmap', { exact: true })[1]);
  fireEvent.click(screen.getByLabelText('Points'));
  fireEvent.click(screen.getByLabelText('Pedestrian'));
  fireEvent.click(screen.getByLabelText('Fatal'));
  expect(useSafetyDataStore.getState()).toMatchObject({
    enabled: true,
    showHeatmap: false,
    showPoints: true,
  });
  expect(useSafetyDataStore.getState().filters.modes.has('pedestrian')).toBe(false);
  expect(useSafetyDataStore.getState().filters.severities.has('fatal')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
  expect(screen.queryByLabelText('Community Hotspots')).not.toBeInTheDocument();
});
it.each([false, true])(
  'starts a proposal with optional geometry (provider failure=%s)',
  async (failure) => {
    useMapStore.setState({
      selectedLocation: { lat: 39.7, lng: -104.9, address: 'Broadway, Denver' },
    });
    if (failure) services.road.mockRejectedValueOnce(new Error('offline'));
    render(<MapControls map={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Propose a Change' }));
    await waitFor(() => expect(services.road).toHaveBeenCalledOnce());
    expect(useWorkspaceStore.getState().mode).toBe('propose');
    expect(useProposalStore.getState().streetName).toBe('Broadway');
    if (!failure) await waitFor(() => expect(useProposalStore.getState().roadPath).toHaveLength(2));
  },
);
it('opens a context menu at the map-relative point and suppresses it while drawing or location-locked', async () => {
  const map = new MapFake();
  const { rerender, unmount } = render(<PinDesignFlow map={null} />);
  rerender(<PinDesignFlow map={map.asMap()} />);
  await act(() => map.emit('click', mouse()));
  expect(useMapStore.getState().contextMenuPosition).toMatchObject({
    x: 120,
    y: 80,
    lat: 39.7,
    lng: -104.9,
  });
  await act(() => map.emit('dragstart'));
  expect(screen.queryByRole('button', { name: /Design a Street Here/ })).not.toBeInTheDocument();
  act(() => useDrawingStore.getState().setActiveTool('road'));
  await act(() => map.emit('click', mouse()));
  expect(useMapStore.getState().contextMenuPosition).toBeNull();
  act(() => {
    useDrawingStore.getState().setActiveTool('select');
    useMapStore.getState().setLockedToLocation(true);
  });
  await act(() => map.emit('click', mouse()));
  expect(useMapStore.getState().contextMenuPosition).toBeNull();
  act(() => useMapStore.getState().setLockedToLocation(false));
  await act(() => map.emit('click', mouse()));
  await act(() => map.emit('zoom'));
  expect(useMapStore.getState().contextMenuPosition).toBeNull();
  unmount();
  expect(map.listeners.get('click')?.size).toBe(0);
  expect(map.listeners.get('zoom')?.size).toBe(0);
});
it.each(['address', 'empty', 'offline'])(
  'opens reports with %s reverse geocoding',
  async (kind) => {
    if (kind === 'empty') services.reverse.mockResolvedValueOnce(null);
    if (kind === 'offline') services.reverse.mockRejectedValueOnce(new Error('offline'));
    const map = new MapFake();
    render(<PinDesignFlow map={map.asMap()} />);
    await act(() => map.emit('click', mouse()));
    fireEvent.click(screen.getByRole('button', { name: /Report a Hotspot/ }));
    await waitFor(() => expect(useMapStore.getState().reportFormOpen).toBe(true));
    expect(useMapStore.getState().reportFormLocation?.address).toBe(
      kind === 'address' ? 'Broadway, Denver' : '39.70000, -104.90000',
    );
    expect(useMapStore.getState().contextMenuPosition).toBeNull();
  },
);
it('opens the street editor and ignores an old reverse-geocode result after the menu closes', async () => {
  const map = new MapFake();
  render(<PinDesignFlow map={map.asMap()} />);
  await act(() => map.emit('click', mouse()));
  fireEvent.click(screen.getByRole('button', { name: /Design a Street Here/ }));
  await waitFor(() => expect(useWorkspaceStore.getState().mode).toBe('configure'));
  expect(useWorkspaceStore.getState().designLocation?.address).toBe('Broadway, Denver');
  let finish!: (value: unknown) => void;
  services.reverse.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(() => map.emit('click', mouse(40, -105)));
  fireEvent.click(screen.getByRole('button', { name: /Report a Hotspot/ }));
  await act(() => map.emit('zoom'));
  await act(async () => finish({ display_name: 'Obsolete' }));
  expect(useMapStore.getState().reportFormOpen).toBe(false);
  expect(useMapStore.getState().selectedLocation?.address).toBe('Broadway, Denver');
});
