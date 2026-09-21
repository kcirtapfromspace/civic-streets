import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HotspotFeedPage from '../HotspotFeedPage';
import HotspotDetailPage from '../HotspotDetailPage';
import ReportPage from '../ReportPage';
import { MOCK_HOTSPOTS } from '@/features/community/mock-data';
import { useMapStore } from '@/features/map/map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCommunityStore } from '@/features/community/community-store';
import { useExplorerStore } from '@/features/community/explorer-store';
import { useReportStore } from '@/features/report/report-store';
import { mapFixture } from '@/features/community/__tests__/map-fixture';
import { billingState } from './billing-fixture';

const { lookup, list } = vi.hoisted(() => ({ lookup: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/api/use-hotspots', async (original) => ({
  ...(await original<object>()),
  useHotspotById: lookup,
  useHotspotsList: list,
  useVoteOnHotspot: () => vi.fn(),
}));
vi.mock('@/lib/api/government', () => ({
  useJurisdictionSummaryForLocation: () => ({ summary: { isSigned: true }, isLoading: false }),
  useUnsignedOutreach: () => ({ queueUnsignedOutreach: vi.fn(), isSubmitting: false }),
}));
vi.mock('@/lib/api/billing', () => ({
  useBilling: () => ({ billingState: billingState(), billingStateLoading: false }),
}));
vi.mock('@/lib/api/geocoding', () => ({ searchPlaces: vi.fn() }));
vi.mock('maplibre-gl', async () => ({
  default: (await import('@/features/community/__tests__/map-fixture')).maplibreFixture,
}));
const hotspot = {
  ...MOCK_HOTSPOTS[0],
  id: 'denver-crossing',
  title: 'Colfax crossing',
  address: 'Colfax and Broadway, Denver',
  lat: 39.74,
  lng: -104.99,
  linkedDesignIds: [],
};
function Destination() {
  const location = useLocation();
  return (
    <output>
      {location.pathname}
      {location.search}
    </output>
  );
}
function showDetail() {
  return render(
    <MemoryRouter initialEntries={['/hotspot/denver-crossing']}>
      <Routes>
        <Route path="/hotspot/:id" element={<HotspotDetailPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  lookup.mockReturnValue({ hotspot, isLoading: false });
  list.mockReturnValue({ hotspots: [hotspot], isLoading: false });
  useMapStore.setState(useMapStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useCommunityStore.setState(useCommunityStore.getInitialState());
  useExplorerStore.setState(useExplorerStore.getInitialState());
  useReportStore.getState().reset();
  mapFixture.reset();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('community route orchestration', () => {
  it('opens a selected feed report at its stable route', () => {
    render(
      <MemoryRouter initialEntries={['/hotspots']}>
        <Routes>
          <Route path="/hotspots" element={<HotspotFeedPage />} />
          <Route path="/hotspot/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Colfax crossing/ })[0]);
    expect(screen.getByRole('status')).toHaveTextContent('/hotspot/denver-crossing');
  });
  it('distinguishes pending lookup from a missing report, then offers a way back', () => {
    lookup.mockReturnValue({ hotspot: null, isLoading: true });
    const view = showDetail();
    expect(screen.queryByText('Hotspot Not Found')).not.toBeInTheDocument();
    lookup.mockReturnValue({ hotspot: null, isLoading: false });
    view.rerender(
      <MemoryRouter initialEntries={['/hotspot/denver-crossing']}>
        <Routes>
          <Route path="/hotspot/:id" element={<HotspotDetailPage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Hotspot Not Found' })).toBeInTheDocument();
    expect(lookup).toHaveBeenLastCalledWith('denver-crossing');
    fireEvent.click(screen.getByRole('link', { name: /Back to Hotspots/ }));
    expect(screen.getByRole('status')).toHaveTextContent('/hotspots');
  });
  it('opens design mode centered on the report and retains the address context', () => {
    showDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Design a Fix' }));
    expect(screen.getByRole('status')).toHaveTextContent('/map');
    expect(useMapStore.getState()).toMatchObject({
      center: { lat: 39.74, lng: -104.99 },
      zoom: 18,
    });
    expect(useWorkspaceStore.getState()).toMatchObject({
      mode: 'propose',
      designLocation: { lat: 39.74, lng: -104.99, address: hotspot.address },
    });
  });
  it('opens map viewing at the report without switching into proposal mode', () => {
    showDetail();
    fireEvent.click(screen.getByRole('button', { name: 'View on Map' }));
    expect(screen.getByRole('status')).toHaveTextContent('/map');
    expect(useMapStore.getState()).toMatchObject({
      center: { lat: 39.74, lng: -104.99 },
      zoom: 17,
    });
    expect(useWorkspaceStore.getState().mode).toBe('explore');
  });
  it('links representative drafts to the report and returns the back action to the feed', () => {
    const view = showDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Send to My Rep' }));
    expect(screen.getByRole('status')).toHaveTextContent('/report?hotspot=denver-crossing');
    view.unmount();
    showDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Back to feed' }));
    expect(screen.getByRole('status')).toHaveTextContent('/hotspots');
  });
});

describe('report route context', () => {
  it('prefills the linked report address and closes back to its previous location', () => {
    render(
      <MemoryRouter initialEntries={['/hotspots', '/report?hotspot=denver-crossing']}>
        <Routes>
          <Route path="/report" element={<ReportPage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(lookup).toHaveBeenLastCalledWith('denver-crossing');
    expect(screen.getByDisplayValue(hotspot.address)).toBeInTheDocument();
    expect(screen.getByText(hotspot.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('status')).toHaveTextContent('/hotspots');
  });
  it('requires an eligible map location for an unlinked report', () => {
    lookup.mockReturnValue({ hotspot: null, isLoading: false });
    render(
      <MemoryRouter initialEntries={['/report']}>
        <ReportPage />
      </MemoryRouter>,
    );
    expect(lookup).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a location on the map');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
