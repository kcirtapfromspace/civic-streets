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
    included: 'Poor Sidewalk concern by 8 community members',
  },
  {
    context: {
      designTitle: 'Safer street',
      designElements: 'wide sidewalks',
      prowagCompliant: true,
    },
    subject: 'Street Design Proposal for Broadway',
    included: 'design meets PROWAG',
  },
  {
    context: { designTitle: 'Concept', prowagCompliant: false },
    subject: 'Street Design Proposal for Broadway',
    included: 'Some elements may require adjustment',
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
    included: '12 upvotes',
  },
])('creates an appropriate reviewable draft for $subject', ({ context, subject, included }) => {
  const input = { repName: 'Council Office', address: 'Broadway', ...context };
  expect(generateReportSubject(input)).toBe(subject);
  const body = generateReportBody(input);
  expect(body).toContain('Dear Council Office,');
  expect(body).toContain(included);
  expect(body.endsWith(context.senderName ?? '[Your Name]')).toBe(true);
  if (context.prowagCompliant === undefined) expect(body).not.toContain('design meets PROWAG');
  if (!context.communityVotes) expect(body).not.toContain('upvotes from community members');
});
