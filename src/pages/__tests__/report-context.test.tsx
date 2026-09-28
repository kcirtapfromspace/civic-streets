import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportPage from '../ReportPage';
import { useReportStore } from '@/features/report/report-store';
import { useMapStore } from '@/features/map/map-store';
import { billingState } from './billing-fixture';

const state = vi.hoisted(() => ({ available: true, lookup: vi.fn() }));
vi.mock('@/lib/api/convex-provider', () => ({ get convexAvailable() { return state.available; } }));
vi.mock('@/lib/api/use-hotspots', async (original) => ({
  ...(await original<object>()), useHotspotById: state.lookup,
}));
vi.mock('@/lib/api/billing', () => ({
  useBilling: () => ({ billingState: billingState(), billingStateLoading: false }),
}));

const report = {
  id: 'real-report-id', title: 'Crossing observation', description: 'Crossing needs attention',
  address: 'Broadway, Denver', lat: 39.74, lng: -104.99, upvotes: 0,
  downvotes: 0, category: 'dangerous-intersection', severity: 'medium', status: 'open',
  commentCount: 0, photoUrls: [], authorId: 'reporter', createdAt: 1, linkedDesignIds: [],
};
const page = (id = report.id) => <MemoryRouter initialEntries={[
  `/report?hotspot=${id}`,
]}><ReportPage /></MemoryRouter>;

beforeEach(() => {
  localStorage.clear();
  state.available = true;
  state.lookup.mockReset().mockReturnValue({ hotspot: report, isLoading: false });
  useReportStore.getState().reset();
  useMapStore.setState(useMapStore.getInitialState());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('representative draft source integrity', () => {
  it('blocks direct links that would turn fictional examples into outward messages', () => {
    state.available = false;
    state.lookup.mockReturnValue({ hotspot: { ...report, id: 'h1', upvotes: 99 }, isLoading: false });
    render(page('h1'));
    expect(screen.getByRole('heading', { name: 'Example reports cannot be sent to representatives' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Share with Your Representatives' })).not.toBeInTheDocument();
    expect(screen.queryByText(/99 upvotes/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose your location on the map' })).toHaveAttribute('href', '/map');
  });

  it('allows a resident-authored local draft without presenting local votes as public participation', () => {
    state.available = false;
    state.lookup.mockReturnValue({ hotspot: { ...report, id: 'local-h1', upvotes: 2 }, isLoading: false });
    render(page('local-h1'));
    expect(screen.getByDisplayValue(report.address)).toBeInTheDocument();
    expect(screen.getByText(report.title)).toBeInTheDocument();
    expect(screen.queryByText(/upvotes? from community members/)).not.toBeInTheDocument();
  });

  it('waits for the selected report before mounting the draft with its address', () => {
    state.lookup.mockReturnValue({ hotspot: null, isLoading: true });
    const view = render(page());
    expect(screen.getByRole('status')).toHaveTextContent('Loading the community report');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    state.lookup.mockReturnValue({ hotspot: report, isLoading: false });
    view.rerender(page());
    expect(screen.getByDisplayValue(report.address)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('saved in this browser');
  });

  it('does not substitute another map location when the linked report is missing', () => {
    state.lookup.mockReturnValue({ hotspot: null, isLoading: false });
    useMapStore.getState().setSelectedLocation({ lat: 39.74, lng: -104.99, address: 'Different location' });
    render(page());
    expect(screen.getByRole('heading', { name: 'Community report not found' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Local demo reports disappear on reload/)).toBeInTheDocument();
  });

  it('offers retry after a lookup failure without exposing an unverified draft or internal error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.lookup.mockImplementation(() => { throw new Error('private backend failure'); });
    render(page());
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.queryByText('private backend failure')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    state.lookup.mockReturnValue({ hotspot: report, isLoading: false });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByDisplayValue(report.address)).toBeInTheDocument();
  });
});
