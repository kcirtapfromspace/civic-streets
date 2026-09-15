import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotspotDetail } from '../HotspotDetail';
import type { MockHotspot } from '../mock-data';

const { useJurisdictionSummaryForLocation, submitCivicReport, showToast } = vi.hoisted(() => ({
  useJurisdictionSummaryForLocation: vi.fn(),
  submitCivicReport: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/lib/api/government', () => ({ useJurisdictionSummaryForLocation }));
vi.mock('@/lib/api/civic-report', () => ({ submitCivicReport }));
vi.mock('@/lib/api/use-hotspots', () => ({ useVoteOnHotspot: () => vi.fn() }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../VoteButton', () => ({ VoteButton: () => null }));
vi.mock('../CommentThread', () => ({ CommentThread: () => null }));
vi.mock('../DesignCard', () => ({ DesignCard: () => null }));
vi.mock('@/features/government/UnsignedJurisdictionOutreachModal', () => ({
  UnsignedJurisdictionOutreachModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Curbwise outreach review" /> : null,
}));

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

describe('Denver city handoff', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useJurisdictionSummaryForLocation.mockReturnValue({
      summary: { isSigned: false, displayName: 'Denver, CO' },
      isLoading: false,
    });
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ['unsigned', { isSigned: false, displayName: 'Denver, CO' }, false],
    ['signed', { isSigned: true, displayName: 'Denver, CO' }, false],
    ['loading', null, true],
  ])(
    'opens the official portal while jurisdiction is %s without submitting or queuing outreach',
    (_state, summary, isLoading) => {
      useJurisdictionSummaryForLocation.mockReturnValue({ summary, isLoading });
      render(<HotspotDetail hotspot={hotspot} />);

      const button = screen.getByRole('button', { name: 'Continue at Denver 311' });
      expect(button).toHaveAccessibleDescription(
        /confirm the location is inside the City and County of Denver/,
      );
      expect(button).toHaveAccessibleDescription(
        /details and photos are not transferred automatically/,
      );
      fireEvent.click(button);

      expect(window.open).toHaveBeenCalledWith(
        'https://www.denvergov.org/Online-Services-Hub/Report-an-Issue',
        '_blank',
        'noopener,noreferrer',
      );
      expect(submitCivicReport).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Report submitted successfully!')).not.toBeInTheDocument();
      expect(screen.queryByText(/Tracking ID:/)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Community report status' })).toBeInTheDocument();
    },
  );

  it('keeps internal outreach as a separate opt-in action', () => {
    render(<HotspotDetail hotspot={hotspot} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Curbwise for outreach' }));
    expect(screen.getByRole('dialog', { name: 'Curbwise outreach review' })).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
    expect(submitCivicReport).not.toHaveBeenCalled();
  });

  it('preserves the unsigned-city flow outside the Denver routing area', () => {
    render(
      <HotspotDetail
        hotspot={{ ...hotspot, lat: 41.8781, lng: -87.6298, address: 'Chicago, IL' }}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Continue at Denver 311' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Report to City' }));
    expect(screen.getByRole('dialog', { name: 'Curbwise outreach review' })).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
    expect(submitCivicReport).not.toHaveBeenCalled();
  });

  it('does not carry another city’s submission result onto a Denver community report', async () => {
    useJurisdictionSummaryForLocation.mockReturnValue({
      summary: { isSigned: true },
      isLoading: false,
    });
    submitCivicReport.mockResolvedValue({ success: true, trackingId: 'chicago-case-1' });
    const { rerender } = render(
      <HotspotDetail
        hotspot={{
          ...hotspot,
          id: 'chicago-hotspot',
          lat: 41.8781,
          lng: -87.6298,
          address: 'Chicago, IL',
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Report to City' }));
    expect(await screen.findByText('Report submitted successfully!')).toBeInTheDocument();

    rerender(<HotspotDetail hotspot={hotspot} />);
    expect(screen.getByRole('button', { name: 'Continue at Denver 311' })).toBeEnabled();
    expect(screen.queryByText('Report submitted successfully!')).not.toBeInTheDocument();
    expect(screen.queryByText('chicago-case-1')).not.toBeInTheDocument();
  });
});
