import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotspotDetail } from '../HotspotDetail';
import { MOCK_HOTSPOTS } from '../mock-data';
import { ToastProvider } from '@/components/ui/Toast';

const { jurisdiction, submit, vote, queue } = vi.hoisted(() => ({
  jurisdiction: vi.fn(),
  submit: vi.fn(),
  vote: vi.fn(),
  queue: vi.fn(),
}));
vi.mock('@/lib/api/government', () => ({
  useJurisdictionSummaryForLocation: jurisdiction,
  useUnsignedOutreach: () => ({ queueUnsignedOutreach: queue, isSubmitting: false }),
}));
vi.mock('@/lib/api/civic-report', () => ({ submitCivicReport: submit }));
vi.mock('@/lib/api/use-hotspots', () => ({ useVoteOnHotspot: () => vote }));
const hotspot = {
  ...MOCK_HOTSPOTS[0],
  id: 'chicago-hotspot',
  address: 'Chicago, IL',
  lat: 41.88,
  lng: -87.63,
  linkedDesignIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  jurisdiction.mockReturnValue({
    summary: { isSigned: true, displayName: 'Chicago' },
    isLoading: false,
  });
  vi.spyOn(window, 'open').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('community report detail actions', () => {
  it('disables city and representative reporting for an older report outside the pilots', () => {
    const rep = vi.fn();
    render(<ToastProvider><HotspotDetail hotspot={{ ...hotspot, lat: 34.05, lng: -118.24 }} onSendToRep={rep} /></ToastProvider>);
    const cityButton = screen.getByRole('button', { name: 'Report to City' });
    const repButton = screen.getByRole('button', { name: 'Send to My Rep' });
    expect(cityButton).toBeDisabled();
    expect(repButton).toBeDisabled();
    fireEvent.click(cityButton);
    fireEvent.click(repButton);
    expect(submit).not.toHaveBeenCalled();
    expect(rep).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Design a Fix' })).toBeEnabled();
  });

  it('routes report actions with the correct identity and displays photos, linked designs, and community status', () => {
    const back = vi.fn(),
      design = vi.fn(),
      rep = vi.fn(),
      map = vi.fn();
    render(
      <HotspotDetail
        hotspot={{
          ...hotspot,
          status: 'resolved',
          photoUrls: ['https://example.test/photo.jpg'],
          linkedDesignIds: ['d1'],
        }}
        onBack={back}
        onDesignFix={design}
        onSendToRep={rep}
        onViewOnMap={map}
      />,
    );
    expect(screen.getByRole('img', { name: 'Photo 1' })).toHaveAttribute(
      'src',
      'https://example.test/photo.jpg',
    );
    expect(screen.getByRole('heading', { name: 'Community Designs (1)' })).toBeInTheDocument();
    expect(screen.getByLabelText('Status: Resolved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to feed' }));
    expect(back).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Design a Fix' }));
    expect(design).toHaveBeenCalledWith(hotspot.id);
    fireEvent.click(screen.getByRole('button', { name: 'Send to My Rep' }));
    expect(rep).toHaveBeenCalledWith(hotspot.id);
    fireEvent.click(screen.getByRole('button', { name: 'View on Map' }));
    expect(map).toHaveBeenCalledWith(41.88, -87.63);
    fireEvent.click(screen.getAllByRole('button', { name: 'Upvote' })[0]);
    expect(vote).toHaveBeenCalledWith(hotspot.id, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Open in Editor' }));
  });
  it.each([
    [30_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [2 * 3_600_000, '2h ago'],
    [5 * 86_400_000, '5d ago'],
    [60 * 86_400_000, '2mo ago'],
  ])('shows report age at %i ms even when the author is unavailable', (age, label) => {
    render(
      <HotspotDetail hotspot={{ ...hotspot, authorId: 'missing', createdAt: Date.now() - age }} />,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Design a Fix' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to My Rep' }));
  });
  it('holds actions while checking coverage, then lets the resident opt in to unsigned-city outreach', () => {
    jurisdiction.mockReturnValue({ summary: null, isLoading: true });
    const { rerender } = render(
      <ToastProvider>
        <HotspotDetail hotspot={hotspot} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Report to City' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to My Rep' }));
    expect(screen.getAllByText('Checking jurisdiction coverage...')).toHaveLength(2);
    expect(submit).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
    jurisdiction.mockReturnValue({
      summary: { isSigned: false, displayName: 'Chicago' },
      isLoading: false,
    });
    rerender(
      <ToastProvider>
        <HotspotDetail hotspot={hotspot} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send to My Rep' }));
    expect(
      screen.getByRole('dialog', { name: 'Ask Curbwise to reach the right office' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('shows a pending city request and only exposes tracking after confirmed success', async () => {
    let finish: (value: unknown) => void = () => {};
    submit.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<HotspotDetail hotspot={hotspot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Report to City' }));
    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    expect(screen.queryByText('Report submitted successfully!')).not.toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith({
      lat: 41.88,
      lng: -87.63,
      address: 'Chicago, IL',
      category: hotspot.category,
      title: hotspot.title,
      description: hotspot.description,
    });
    await act(async () =>
      finish({ success: true, trackingId: 'case-42', trackingUrl: 'https://example.test/case-42' }),
    );
    expect(screen.getByText('case-42')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track your report →' })).toHaveAttribute(
      'href',
      'https://example.test/case-42',
    );
  });
  it.each([
    [{ success: false, error: 'City service unavailable' }, 'City service unavailable'],
    [{ success: false }, 'Failed to submit report.'],
  ])('keeps failed requests retryable without inventing a city case', async (result, message) => {
    submit.mockResolvedValueOnce(result).mockResolvedValueOnce({ success: true });
    render(<HotspotDetail hotspot={hotspot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Report to City' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/Tracking ID:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Report to City' }));
    expect(await screen.findByText('Report submitted successfully!')).toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });
  it('opens a portal result without saying that a city report was submitted', async () => {
    submit.mockResolvedValue({ success: false, deepLinkUrl: 'https://example.test/311' });
    render(<HotspotDetail hotspot={hotspot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Report to City' }));
    await act(async () => {});
    expect(window.open).toHaveBeenCalledWith('https://example.test/311', '_blank', 'noopener');
    expect(screen.queryByText('Report submitted successfully!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report to City' })).toBeEnabled();
  });
});
