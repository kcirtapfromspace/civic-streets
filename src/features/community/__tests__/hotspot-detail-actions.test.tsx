import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotspotDetail } from '../HotspotDetail';
import type { MockHotspot } from '../mock-data';

const { connected, submit, vote, jurisdiction } = vi.hoisted(() => ({
  connected: { value: true },
  submit: vi.fn(),
  vote: vi.fn(),
  jurisdiction: vi.fn(),
}));
vi.mock('@/lib/api/convex-provider', () => ({
  get convexAvailable() {
    return connected.value;
  },
}));
vi.mock('@/lib/api/government', () => ({ useJurisdictionSummaryForLocation: jurisdiction }));
vi.mock('@/lib/api/civic-report', () => ({ submitCivicReport: submit }));
vi.mock('@/lib/api/use-hotspots', () => ({ useVoteOnHotspot: () => vote }));

const hotspot: MockHotspot = {
  id: 'chicago-hotspot',
  title: 'Missing curb ramp',
  description: 'The crossing needs an accessible curb ramp.',
  category: 'accessibility',
  severity: 'high',
  status: 'open',
  address: 'Chicago, IL',
  lat: 41.88,
  lng: -87.63,
  upvotes: 5,
  downvotes: 1,
  commentCount: 0,
  photoUrls: [],
  authorId: 'u1',
  createdAt: Date.now(),
  linkedDesignIds: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  connected.value = true;
  jurisdiction.mockImplementation(() => {
    throw new Error('Government backend is unavailable');
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('community report detail actions', () => {
  it('keeps brief inputs with the same observation and resets them when opening another without duplicate keys', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<HotspotDetail hotspot={hotspot} />);
    fireEvent.click(screen.getByText('Make a brief from this observation'));
    fireEvent.change(screen.getByLabelText(/What are you asking for/), { target: { value: 'A site visit at this location' } });
    view.rerender(<HotspotDetail hotspot={{ ...hotspot, upvotes: 6 }} />);
    expect(screen.getByLabelText(/What are you asking for/)).toHaveValue('A site visit at this location');
    view.rerender(<HotspotDetail hotspot={{ ...hotspot, id: 'another-place' }} />);
    expect(screen.getByText('Make a brief from this observation').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Make a brief from this observation'));
    expect(screen.getByLabelText(/What are you asking for/)).toHaveValue('');
    expect(errors).not.toHaveBeenCalled();
  });

  it('keeps verified city links accessible outside community pilot coverage', () => {
    const rep = vi.fn();
    render(<HotspotDetail hotspot={{ ...hotspot, lat: 34.05, lng: -118.24 }} onSendToRep={rep} />);
    fireEvent.click(screen.getByText('Optional follow-up'));
    expect(screen.getByRole('link', { name: 'Continue at Los Angeles reporting' })).toHaveAttribute(
      'href',
      'https://myla311.lacity.gov/',
    );
    const repButton = screen.getByRole('button', { name: 'Prepare a representative draft' });
    expect(repButton).toBeDisabled();
    expect(repButton).toHaveAccessibleDescription(/Representative drafts are unavailable/);
    fireEvent.click(repButton);
    expect(rep).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(jurisdiction).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Explore a change here' })).toBeDisabled();
  });

  it('offers an honest unavailable state when no verified portal covers the location', () => {
    render(<HotspotDetail hotspot={{ ...hotspot, lat: 0, lng: 0 }} />);
    fireEvent.click(screen.getByText('Optional follow-up'));
    const city = screen.getByRole('button', { name: 'City reporting unavailable' });
    expect(city).toBeDisabled();
    expect(city).toHaveAccessibleDescription(/do not have a verified public reporting link/);
    fireEvent.click(city);
    expect(screen.queryByRole('link', { name: /Continue at/ })).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('routes actions with the report identity and exposes community status without fabricated discussion', () => {
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
    expect(screen.getByLabelText('Community status: Resolved')).toBeInTheDocument();
    expect(screen.getByText(/does not confirm city receipt/)).toBeInTheDocument();
    expect(screen.queryByText('Alex R.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Community Designs/ })).not.toBeInTheDocument();
    for (const field of screen.queryAllByRole('textbox')) expect(field).not.toBeVisible();
    expect(
      screen.getByText(
        'Discussion and linked community designs are not available for this observation.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to observations' }));
    expect(back).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Explore a change here' }));
    expect(design).toHaveBeenCalledWith(hotspot.id);
    fireEvent.click(screen.getByText('Optional follow-up'));
    const repButton = screen.getByRole('button', { name: 'Prepare a representative draft' });
    expect(repButton).toHaveAccessibleDescription(/opens a draft for you to review/);
    fireEvent.click(repButton);
    expect(rep).toHaveBeenCalledWith(hotspot.id);
    fireEvent.click(screen.getByRole('button', { name: 'View on Map' }));
    expect(map).toHaveBeenCalledWith(41.88, -87.63);
    expect(jurisdiction).not.toHaveBeenCalled();
  });

  it('handles a failed vote and permits retry without retaining the failed optimistic count', async () => {
    vote.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined);
    render(<HotspotDetail hotspot={hotspot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your vote could not be saved. Please try again.',
    );
    expect(screen.getByLabelText('4 votes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upvote' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    await waitFor(() => expect(vote).toHaveBeenCalledTimes(2));
    expect(vote).toHaveBeenLastCalledWith(hotspot.id, 1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    [30_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [2 * 3_600_000, '2h ago'],
    [5 * 86_400_000, '5d ago'],
    [60 * 86_400_000, '2mo ago'],
  ])('shows report age at %i ms without inventing an author', (age, label) => {
    render(
      <HotspotDetail hotspot={{ ...hotspot, authorId: 'missing', createdAt: Date.now() - age }} />,
    );
    expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
    expect(screen.getByText(/Community observation/)).toBeInTheDocument();
    expect(screen.queryByText('Anonymous')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Explore a change here' }));
    fireEvent.click(screen.getByText('Optional follow-up'));
    expect(screen.getByRole('button', { name: 'Prepare a representative draft' })).toBeDisabled();
  });

  it.each([
    ['h1', 'Example observation', /illustrative example, not an observation from a resident/],
    ['local-h1', 'Browser-session observation', /stored only in this browser session/],
  ])(
    'labels %s honestly when the backend is unconfigured and does not simulate voting',
    (id, label, notice) => {
      connected.value = false;
      const rep = vi.fn();
      render(<HotspotDetail hotspot={{ ...hotspot, id }} onSendToRep={rep} />);
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
      expect(screen.getByText(notice)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upvote' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Downvote' })).not.toBeInTheDocument();
      expect(vote).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Optional follow-up'));
      const repButton = screen.getByRole('button', { name: 'Prepare a representative draft' });
      fireEvent.click(repButton);
      if (id === 'h1') {
        expect(repButton).toBeDisabled();
        expect(repButton).toHaveAccessibleDescription(/unavailable for fictional examples/);
        expect(rep).not.toHaveBeenCalled();
      } else {
        expect(repButton).toBeEnabled();
        expect(rep).toHaveBeenCalledWith(id);
      }
    },
  );
});

it('shows captured evidence before a closed, optional follow-up and resets disclosure for another observation', () => {
  const createdAt = Date.UTC(2026, 8, 20, 12);
  const { rerender } = render(<HotspotDetail hotspot={{ ...hotspot, createdAt, issueGroup: 'sidewalk', issueType: 'no-curb-ramp', isBlocking: true, photoUrls: ['https://example.test/evidence.jpg'] }} />);
  const evidence = screen.getByRole('region', { name: 'Observation details' });
  expect(evidence).toHaveTextContent('Chicago, IL');
  expect(evidence).toHaveTextContent('41.88000, -87.63000');
  expect(evidence).toHaveTextContent('Sidewalk & Path');
  expect(evidence).toHaveTextContent('No Curb Ramp');
  expect(evidence).toHaveTextContent('Blocking passageYes');
  expect(evidence).toHaveTextContent('Saved');
  expect(evidence.querySelector('time')).toHaveAttribute('datetime', new Date(createdAt).toISOString());
  expect(screen.getByRole('heading', { name: 'Notes' })).toBeVisible();
  expect(screen.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  const summary = screen.getByText('Optional follow-up');
  const disclosure = summary.closest('details')!;
  expect(disclosure).not.toHaveAttribute('open');
  expect(evidence.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText('Prepare a representative draft')).not.toBeVisible();
  expect(screen.getByText('Continue at Chicago reporting')).not.toBeVisible();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(summary);
  expect(disclosure).toHaveAttribute('open');
  expect(screen.getByRole('link', { name: 'Continue at Chicago reporting' })).toBeVisible();
  fireEvent.click(summary);
  expect(disclosure).not.toHaveAttribute('open');
  fireEvent.click(summary);
  rerender(<HotspotDetail hotspot={{ ...hotspot, id: 'another-observation' }} />);
  expect(screen.getByText('Optional follow-up').closest('details')).not.toHaveAttribute('open');
  expect(screen.queryByText('Issue group')).not.toBeInTheDocument();
  expect(screen.queryByText('Issue type')).not.toBeInTheDocument();
  expect(screen.queryByText('Blocking passage')).not.toBeInTheDocument();
});

it('preserves an explicit nonblocking answer and unfamiliar recorded issue labels without inventing notes', () => {
  render(<HotspotDetail hotspot={{ ...hotspot, description: '', issueGroup: 'custom-group' as MockHotspot['issueGroup'], issueType: 'custom-issue', isBlocking: false }} />);
  const evidence = screen.getByRole('region', { name: 'Observation details' });
  expect(evidence).toHaveTextContent('custom-group');
  expect(evidence).toHaveTextContent('custom-issue');
  expect(evidence).toHaveTextContent('Blocking passageNo');
  expect(evidence).toHaveTextContent('No notes added.');
});
