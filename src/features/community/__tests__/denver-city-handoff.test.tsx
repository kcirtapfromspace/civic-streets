import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotspotDetail } from '../HotspotDetail';
import type { MockHotspot } from '../mock-data';

const { jurisdiction, submitCivicReport } = vi.hoisted(() => ({
  jurisdiction: vi.fn(),
  submitCivicReport: vi.fn(),
}));
vi.mock('@/lib/api/convex-provider', () => ({ convexAvailable: true }));
vi.mock('@/lib/api/government', () => ({ useJurisdictionSummaryForLocation: jurisdiction }));
vi.mock('@/lib/api/civic-report', () => ({ submitCivicReport }));
vi.mock('@/lib/api/use-hotspots', () => ({ useVoteOnHotspot: () => vi.fn() }));

const hotspot: MockHotspot = {
  id: 'denver-hotspot',
  title: 'Missing curb ramp',
  description: 'The crossing needs an accessible curb ramp.',
  category: 'accessibility',
  severity: 'high',
  status: 'open',
  address: 'Broadway & Colfax, Denver, CO',
  lat: 39.7392,
  lng: -104.9903,
  upvotes: 0,
  downvotes: 0,
  commentCount: 0,
  photoUrls: [],
  authorId: 'reporter',
  createdAt: Date.now(),
  linkedDesignIds: [],
};

describe('public city handoffs', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ['unsigned', { isSigned: false }, false],
    ['signed', { isSigned: true }, false],
    ['loading', null, true],
  ])(
    'offers the Denver portal and representative draft while jurisdiction is %s',
    (_state, summary, isLoading) => {
      jurisdiction.mockReturnValue({ summary, isLoading });
      const rep = vi.fn();
      render(<HotspotDetail hotspot={hotspot} onSendToRep={rep} />);
      fireEvent.click(screen.getByText('Optional follow-up'));
      const link = screen.getByRole('link', { name: 'Continue at Denver 311' });
      expect(link).toHaveAttribute(
        'href',
        'https://www.denvergov.org/Online-Services-Hub/Report-an-Issue',
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAccessibleDescription(
        /confirm the location is inside the City and County of Denver/,
      );
      expect(link).toHaveAccessibleDescription(
        /details and photos are not transferred automatically/,
      );
      expect(link).toHaveAccessibleDescription(/does not submit or track the city case/);
      fireEvent.click(link);
      fireEvent.click(screen.getByRole('button', { name: 'Prepare a representative draft' }));
      expect(rep).toHaveBeenCalledWith(hotspot.id);
      expect(submitCivicReport).not.toHaveBeenCalled();
      expect(jurisdiction).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Government live')).not.toBeInTheDocument();
      expect(screen.queryByText('Outreach')).not.toBeInTheDocument();
      expect(screen.queryByText('Report submitted successfully!')).not.toBeInTheDocument();
      expect(screen.queryByText(/Tracking ID:/)).not.toBeInTheDocument();
    },
  );

  it.each([
    ['Chicago', 41.8781, -87.6298, 'https://311.chicago.gov/s/service-request?language=en_US'],
    ['New York City', 40.7128, -74.006, 'https://portal.311.nyc.gov/report-problems/'],
  ])(
    'offers the %s public portal without waiting for a government service',
    (city, lat, lng, url) => {
      jurisdiction.mockImplementation(() => {
        throw new Error('Backend offline');
      });
      render(<HotspotDetail hotspot={{ ...hotspot, lat, lng, address: city }} />);
      fireEvent.click(screen.getByText('Optional follow-up'));
      const link = screen.getByRole('link', { name: `Continue at ${city} reporting` });
      expect(link).toHaveAttribute('href', url);
      fireEvent.click(link);
      expect(jurisdiction).not.toHaveBeenCalled();
      expect(submitCivicReport).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Report submitted successfully!')).not.toBeInTheDocument();
    },
  );

  it('updates the portal on navigation without carrying a city submission result to another report', () => {
    const { rerender } = render(
      <HotspotDetail hotspot={{ ...hotspot, lat: 41.8781, lng: -87.6298 }} />,
    );
    fireEvent.click(screen.getByText('Optional follow-up'));
    fireEvent.click(screen.getByRole('link', { name: 'Continue at Chicago reporting' }));
    rerender(<HotspotDetail hotspot={hotspot} />);
    expect(screen.getByRole('link', { name: 'Continue at Denver 311' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Continue at Chicago reporting' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Report submitted successfully!')).not.toBeInTheDocument();
    expect(submitCivicReport).not.toHaveBeenCalled();
  });
});
