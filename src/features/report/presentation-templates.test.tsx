import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RepCard, ReportSuccess, MOCK_REPS } from './index';
import { generateReportBody, generateReportSubject } from './templates';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('displays demo contact details and toggles selected and photo-only contact cards', () => {
  const toggle = vi.fn();
  const rep = MOCK_REPS[0];
  const { rerender } = render(<RepCard rep={rep} selected={false} onToggle={toggle} />);
  expect(screen.getByText('MR')).toBeInTheDocument();
  expect(screen.getByText(rep.phone!)).toBeInTheDocument();
  expect(screen.getByText(rep.email!)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Maria Rodriguez/ }));
  expect(toggle).toHaveBeenCalledWith(rep);
  rerender(
    <RepCard
      rep={{
        name: 'District Office',
        title: 'Council',
        photoUrl: 'https://city.example/office.jpg',
      }}
      selected
      onToggle={toggle}
    />,
  );
  expect(screen.getByRole('img', { name: 'Photo of District Office' })).toHaveAttribute(
    'src',
    'https://city.example/office.jpg',
  );
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByText(rep.phone!)).not.toBeInTheDocument();
});
it.each([false, true])(
  'shares prepared-message text without claiming delivery when clipboard failure=%s',
  async (failure) => {
    vi.useFakeTimers();
    const clipboard = vi.fn();
    if (failure) clipboard.mockRejectedValue(new Error('unavailable'));
    else clipboard.mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: clipboard } });
    const another = vi.fn();
    render(
      <ReportSuccess
        reps={[MOCK_REPS[0], MOCK_REPS[1]]}
        address="Broadway & Colfax"
        onReportAnother={another}
      />,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Your Email Draft Is Ready');
    act(() => vi.advanceTimersByTime(100));
    expect(document.querySelector('.animate-draw-check')).not.toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy Share Text' })));
    const text = 'I prepared a message about street safety at Broadway & Colfax using Curbwise.';
    expect(clipboard).toHaveBeenCalledWith(text);
    expect(
      new URL(
        screen.getByRole('link', { name: 'Share on X' }).getAttribute('href')!,
      ).searchParams.get('text'),
    ).toBe(text);
    expect(screen.getByText(/Curbwise cannot confirm/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Report Another Issue' }));
    expect(another).toHaveBeenCalledOnce();
  },
);
it.each([
  {
    context: {},
    subject: 'Street Improvement Request for Broadway',
    included: 'would benefit from street improvements',
  },
  {
    context: {
      hotspotTitle: 'Missing ramp',
      hotspotDescription: 'The curb prevents access.',
      hotspotVotes: 1,
    },
    subject: 'Street Safety Concern at Broadway',
    included: 'The curb prevents access.',
  },
  {
    context: { hotspotCategory: 'poor-sidewalk', hotspotVotes: 8 },
    subject: 'Street Safety Concern at Broadway',
    included: 'review a Poor Sidewalk concern',
  },
  {
    context: {
      designTitle: 'Safer street',
      designElements: 'wide sidewalks',
      prowagCompliant: true,
    },
    subject: 'Street Design Proposal for Broadway',
    included: 'passing Curbwise’s selected PROWAG checks',
  },
  {
    context: { designTitle: 'Concept', prowagCompliant: false },
    subject: 'Street Design Proposal for Broadway',
    included: 'issues in Curbwise’s selected PROWAG checks',
  },
  {
    context: { designTitle: 'Untested concept' },
    subject: 'Street Design Proposal for Broadway',
    included: 'available for your review',
  },
  {
    context: {
      hotspotTitle: 'Unsafe crossing',
      designTitle: 'Refuge island',
      communityVotes: 12,
      senderName: 'Resident',
    },
    subject: 'Street Safety Concern and Design Proposal for Broadway',
    included: '12 recorded upvotes',
  },
])('creates an appropriate reviewable draft for $subject', ({ context, subject, included }) => {
  const input = { repName: 'Council Office', address: 'Broadway', ...context };
  expect(generateReportSubject(input)).toBe(subject);
  const body = generateReportBody(input);
  expect(body).toContain('Dear Council Office,');
  expect(body).toContain(included);
  expect(body.endsWith(context.senderName ?? '[Your Name]')).toBe(true);
  expect(body).not.toMatch(/design meets PROWAG|broad support|upvotes from community members|nationally recognized/);
  if (context.designTitle) {
    expect(body).toContain('preliminary street design concept');
    expect(body).toContain('do not establish accessibility compliance, engineering approval, or city approval');
  }
});

it.each([undefined, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  'omits unsupported vote claims when recorded count is %s',
  (votes) => {
    const body = generateReportBody({
      repName: 'Council Office', address: 'Broadway', hotspotTitle: 'Missing ramp',
      hotspotVotes: votes, communityVotes: votes,
    });
    expect(body).toContain('I would like you to review a safety concern');
    expect(body).not.toMatch(/upvotes?|community members|reflects observed conditions/);
  },
);

it.each([
  { hotspotVotes: 1, communityVotes: undefined, expected: '1 recorded upvote on Curbwise' },
  { hotspotVotes: undefined, communityVotes: 1, expected: '1 recorded upvote on Curbwise' },
  { hotspotVotes: 8, communityVotes: 8, expected: '8 recorded upvotes on Curbwise' },
  { hotspotVotes: 8, communityVotes: 12, expected: '12 recorded upvotes on Curbwise' },
])('reports recorded counts without inventing consensus or adding overlapping votes: $expected',
  ({ hotspotVotes, communityVotes, expected }) => {
    const body = generateReportBody({
      repName: 'Council Office', address: 'Broadway', hotspotTitle: 'Missing ramp',
      hotspotVotes, communityVotes,
    });
    expect(body).toContain(expected);
    expect(body).toContain('This activity count does not establish wider community support.');
    expect(body.match(/recorded upvotes?/g)).toHaveLength(1);
    expect(body).not.toMatch(/\d+ community members|broad support/);
  },
);
