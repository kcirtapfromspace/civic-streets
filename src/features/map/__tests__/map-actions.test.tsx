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
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('does not open competing location actions while placing an existing layout', async () => {
  const map = new MapFake();
  render(<PinDesignFlow map={map.asMap()} />);
  useWorkspaceStore.setState({ mode: 'place-street' });
  await act(() => map.emit('click', mouse()));
  expect(useMapStore.getState().contextMenuPosition).toBeNull();
});
it('lets placement search move the map without replacing the existing draft', () => {
  useWorkspaceStore.setState({ mode: 'place-street' });
  useProposalStore.getState().initConcern('My existing concept');
  const id = useProposalStore.getState().proposalId;
  services.results = [{ place_id: 1, lat: '40', lon: '-105', display_name: 'Pearl Street, Boulder' }];
  render(<MapControls map={new MapFake().asMap()} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search places' }), { target: { value: 'Pearl' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pearl Street, Boulder' }));
  expect(useMapStore.getState().center).toEqual({ lat: 40, lng: -105 });
  expect(useProposalStore.getState().proposalId).toBe(id);
  expect(useWorkspaceStore.getState().mode).toBe('place-street');
  expect(screen.queryByRole('button', { name: 'Sketch a change' })).not.toBeInTheDocument();
});
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
  expect(screen.queryByRole('button', { name: 'Earth' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Map options' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Sketch a change' }));
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
  expect(screen.queryByRole('button', { name: /Sketch a change/ })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /Mark a problem/ }));
    await waitFor(() => expect(useMapStore.getState().reportFormOpen).toBe(true));
    expect(useMapStore.getState().reportFormLocation?.address).toBe(
      kind === 'address' ? 'Broadway, Denver' : '39.70000, -104.90000',
    );
    expect(useMapStore.getState().contextMenuPosition).toBeNull();
  },
);
it('opens a guided proposal and ignores an old reverse-geocode result after the menu closes', async () => {
  const map = new MapFake();
  render(<PinDesignFlow map={map.asMap()} />);
  await act(() => map.emit('click', mouse()));
  fireEvent.click(screen.getByRole('button', { name: /Sketch a change/ }));
  await waitFor(() => expect(useWorkspaceStore.getState().mode).toBe('propose'));
  expect(useProposalStore.getState().streetName).toBe('Broadway');
  await waitFor(() => expect(useProposalStore.getState().roadPath).toHaveLength(2));
  expect(useWorkspaceStore.getState().designLocation?.address).toBe('Broadway, Denver');
  let finish!: (value: unknown) => void;
  services.reverse.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(() => map.emit('click', mouse(40, -105)));
  fireEvent.click(screen.getByRole('button', { name: /Mark a problem/ }));
  await act(() => map.emit('zoom'));
  await act(async () => finish({ display_name: 'Obsolete' }));
  expect(useMapStore.getState().reportFormOpen).toBe(false);
  expect(useMapStore.getState().selectedLocation?.address).toBe('Broadway, Denver');
});

it('keeps problem capture and sketch entry points available outside community pilot areas', async () => {
  useMapStore.getState().openContextMenu({ lat: 34.05, lng: -118.24, x: 380, y: 820 });
  render(<PinDesignFlow map={null} />);
  expect(screen.getByRole('button', { name: /Sketch a change/ })).toBeEnabled();
  const report = screen.getByRole('button', { name: /Mark a problem/ });
  expect(report).toBeEnabled();
  fireEvent.click(report);
  await waitFor(() => expect(useMapStore.getState().reportFormOpen).toBe(true));
  expect(services.reverse).toHaveBeenCalledWith(34.05, -118.24);
});

it('guides residents from approximate location to a selected street and opens the report form', () => {
  useMapStore.setState({
    initialLocationStatus: 'located',
    initialLocationLabel: 'Denver, Colorado',
  });
  const view = render(<MapControls map={null} />);
  expect(screen.getByText('Find your street')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Search places' })).toHaveAccessibleDescription(
    /click a block to mark a problem/,
  );
  expect(screen.getByText('Near Denver, Colorado · approximate IP location')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute(
    'href',
    'https://www.geojs.io/docs/v1/endpoints/geo/',
  );
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
    'href',
    'https://www.geojs.io/privacy/',
  );
  act(() =>
    useMapStore.setState({
      selectedLocation: { lat: 34.05, lng: -118.24, address: 'Spring St, Los Angeles' },
    }),
  );
  expect(screen.getByText('Location selected')).toBeInTheDocument();
  expect(screen.getByText('Describe the problem at this spot.')).toBeInTheDocument();
  expect(screen.queryByText(/approximate IP location/)).not.toBeInTheDocument();
  const reportButton = screen.getByRole('button', { name: 'Mark a problem' });
  expect(reportButton).toBeEnabled();
  fireEvent.click(reportButton);
  expect(useMapStore.getState()).toMatchObject({
    reportFormOpen: true,
    reportFormLocation: { lat: 34.05, lng: -118.24, address: 'Spring St, Los Angeles' },
  });
  act(() =>
    useWorkspaceStore
      .getState()
      .enterProposeMode({ lat: 34.05, lng: -118.24, address: 'Spring St' }),
  );
  expect(screen.queryByRole('button', { name: 'Mark a problem' })).not.toBeInTheDocument();
  view.unmount();
});

it.each([
  ['idle', null, 'Finding your area…'],
  ['loading', null, 'Finding your area…'],
  ['fallback', null, 'Starting in Denver. Search for your street.'],
  ['located', null, 'Near your area · approximate IP location'],
] as const)(
  'explains %s startup location without claiming street accuracy',
  (initialLocationStatus, initialLocationLabel, message) => {
    useMapStore.setState({ initialLocationStatus, initialLocationLabel });
    render(<MapControls map={null} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  },
);

it('keeps manually chosen starting locations free of geolocation claims', () => {
  useMapStore.setState({ initialLocationStatus: 'skipped' });
  render(<MapControls map={null} />);
  expect(
    screen.queryByText(/Finding your area|approximate IP|Starting in Denver/),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'How it works' })).not.toBeInTheDocument();
});

it('moves through search results with arrow keys and dismisses them with Escape', async () => {
  services.results = [
    { place_id: 1, lat: '39.7', lon: '-104.9', display_name: 'Broadway, Denver' },
    { place_id: 2, lat: '39.74', lon: '-104.99', display_name: 'Colfax, Denver' },
  ];
  render(<MapControls map={null} />);
  const input = screen.getByRole('textbox', { name: 'Search places' });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  const first = screen.getByRole('button', { name: 'Broadway, Denver' });
  const second = screen.getByRole('button', { name: 'Colfax, Denver' });
  await waitFor(() => expect(first).toHaveFocus());
  fireEvent.keyDown(first, { key: 'ArrowUp' });
  await waitFor(() => expect(second).toHaveFocus());
  fireEvent.keyDown(second, { key: 'ArrowDown' });
  await waitFor(() => expect(first).toHaveFocus());
  fireEvent.keyDown(first, { key: 'Escape' });
  expect(input).toHaveFocus();
  expect(screen.queryByRole('list', { name: 'Search results' })).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Colfax, Denver' })).toHaveFocus());
  fireEvent.click(screen.getByRole('button', { name: 'Colfax, Denver' }));
  expect(input).toHaveFocus();
  expect(screen.queryByRole('list', { name: 'Search results' })).not.toBeInTheDocument();
  expect(useMapStore.getState().selectedLocation?.address).toBe('Colfax, Denver');
  fireEvent.keyDown(input, { key: 'Escape' });
  fireEvent.keyDown(input, { key: 'Tab' });
});

it('opens optional map controls and closes them on Escape, toggle, and outside interaction', () => {
  render(<MapControls map={new MapFake().asMap()} />);
  const button = screen.getByRole('button', { name: 'Map options' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: 'Map options' })).toHaveTextContent(/zoom/);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Satellite' }), { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Map options' })).not.toBeInTheDocument();
  expect(button).toHaveFocus();
  fireEvent.click(button);
  fireEvent.keyDown(button, { key: 'Tab' });
  fireEvent.click(document.body);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

it('dismisses a pin action using the close button or Escape without changing the selected street', async () => {
  const map = new MapFake();
  render(<PinDesignFlow map={map.asMap()} />);
  await act(() => map.emit('click', mouse()));
  expect(screen.getByRole('button', { name: /Mark a problem/ })).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(
    screen.getByRole('dialog', { name: 'Choose an action at this location' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close location actions' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  await act(() => map.emit('click', mouse()));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(useMapStore.getState().selectedLocation).toBeNull();
});

it('prevents duplicate pin actions and ignores address lookups after unmount', async () => {
  let finish!: (value: unknown) => void;
  services.reverse.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  useMapStore.getState().openContextMenu({ lat: 39.7, lng: -104.9, x: 10, y: 10 });
  const view = render(<PinDesignFlow map={null} />);
  const button = screen.getByRole('button', { name: /Sketch a change/ });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Finding the address…');
  expect(services.reverse).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => finish({ display_name: 'Old result' }));
  expect(useWorkspaceStore.getState().mode).toBe('explore');
  expect(useMapStore.getState().selectedLocation).toBeNull();
});

it.each(['search', 'pin'] as const)(
  'keeps %s proposals usable when optional road geometry fails',
  async (source) => {
    services.road.mockRejectedValueOnce(new Error('offline'));
    if (source === 'search') {
      useMapStore.setState({
        selectedLocation: { lat: 39.7, lng: -104.9, address: 'Broadway, Denver' },
      });
      render(<MapControls map={null} />);
    } else {
      useMapStore.getState().openContextMenu({ lat: 39.7, lng: -104.9, x: 10, y: 10 });
      render(<PinDesignFlow map={null} />);
    }
    fireEvent.click(screen.getByRole('button', { name: /Sketch a change/ }));
    await waitFor(() => expect(services.road).toHaveBeenCalledOnce());
    expect(useWorkspaceStore.getState().mode).toBe('propose');
    expect(useProposalStore.getState()).toMatchObject({
      streetName: 'Broadway',
      roadPath: [],
      step: 'concern',
    });
  },
);

it.each([
  ['search', 'replace'],
  ['search', 'exit'],
  ['pin', 'replace'],
  ['pin', 'exit'],
] as const)('ignores late geometry from %s after %s', async (source, change) => {
  let finish!: (value: unknown) => void;
  services.road.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  if (source === 'search') {
    useMapStore.setState({
      selectedLocation: { lat: 39.7, lng: -104.9, address: 'Broadway, Denver' },
    });
    render(<MapControls map={null} />);
  } else {
    useMapStore.getState().openContextMenu({ lat: 39.7, lng: -104.9, x: 10, y: 10 });
    render(<PinDesignFlow map={null} />);
  }
  fireEvent.click(screen.getByRole('button', { name: /Sketch a change/ }));
  await waitFor(() => expect(services.road).toHaveBeenCalledOnce());
  act(() => {
    if (change === 'replace')
      useProposalStore
        .getState()
        .initProposal('Colfax', { lat: 39.74, lng: -104.99, address: 'Colfax' });
    else useWorkspaceStore.getState().exitToExplore();
  });
  await act(async () => finish({ path: [{ lat: 39.7, lng: -104.9 }], bearing: 90 }));
  expect(useProposalStore.getState().roadPath).toEqual([]);
});

it.each(['empty', 'offline'])(
  'uses a readable street title when pin address lookup is %s',
  async (result) => {
    if (result === 'empty') services.reverse.mockResolvedValueOnce(null);
    else services.reverse.mockRejectedValueOnce(new Error('offline'));
    useMapStore.getState().openContextMenu({ lat: 39.7, lng: -104.9, x: 10, y: 10 });
    render(<PinDesignFlow map={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Sketch a change/ }));
    await waitFor(() => expect(useWorkspaceStore.getState().mode).toBe('propose'));
    expect(useProposalStore.getState()).toMatchObject({
      streetName: 'Selected street',
      location: { address: '39.70000, -104.90000' },
    });
  },
);

it('uses a readable street title and clears floating map controls from the guided proposal actions', async () => {
  useMapStore.setState({
    selectedLocation: { lat: 39.7, lng: -104.9, address: '39.70000, -104.90000' },
  });
  render(<MapControls map={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sketch a change' }));
  await waitFor(() => expect(services.road).toHaveBeenCalledOnce());
  expect(useProposalStore.getState().streetName).toBe('Selected street');
  expect(screen.queryByRole('region', { name: 'Find a street' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Map options' })).not.toBeInTheDocument();
  act(() => useWorkspaceStore.getState().exitToExplore());
  expect(screen.getByRole('button', { name: 'Map options' })).toBeInTheDocument();
});

it.each(['search', 'pin'] as const)('protects unfinished concern work after storage failure when starting a new sketch from %s', async (source) => {
  useProposalStore.getState().initProposal('Unfinished street', { lat: 39.6, lng: -104.8, address: 'Unfinished street' });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  useProposalStore.getState().setBriefContext({ concern: 'Preserve these notes' });
  const showAction = () => {
    if (source === 'search') {
      useMapStore.setState({ selectedLocation: { lat: 39.7, lng: -104.9, address: 'Broadway, Denver' } });
    } else {
      useMapStore.getState().openContextMenu({ lat: 39.7, lng: -104.9, x: 10, y: 10 });
    }
  };
  showAction();
  render(source === 'search' ? <MapControls map={null} /> : <PinDesignFlow map={null} />);
  fireEvent.click(screen.getByRole('button', { name: /Sketch a change/ }));
  expect(await screen.findByRole('dialog', { name: 'Replace unsaved work?' })).toBeInTheDocument();
  expect(useProposalStore.getState().briefContext.concern).toBe('Preserve these notes');
  expect(services.road).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
  act(showAction);
  fireEvent.click(screen.getByRole('button', { name: /Sketch a change/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Discard changes and start proposal' }));
  await waitFor(() => expect(services.road).toHaveBeenCalledOnce());
  expect(useProposalStore.getState()).toMatchObject({ step: 'concern', streetName: 'Broadway', briefContext: { concern: '' } });
  expect(useProposalStore.getState().briefContext.observation).toBeUndefined();
});
