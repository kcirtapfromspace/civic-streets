import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '../LandingPage';
import InstitutionsPage from '../InstitutionsPage';
import NotFoundPage from '../NotFoundPage';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('public pages', () => {
  it('starts at a place and shows the connection to sourced street concepts', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Turn a street concern into a clear proposal.',
    );
    expect(screen.getByRole('link', { name: 'Start with a place' })).toHaveAttribute('href', '/map');
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('href') === '/map')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Street concept example' })).toBeVisible();
    expect(screen.getByText('Broadway, Denver')).toBeVisible();
    const sourceSummary = screen.getByText('Sources, assumptions, and open questions');
    expect(sourceSummary.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(sourceSummary);
    expect(sourceSummary.closest('details')).toHaveAttribute('open');
    for (const source of [
      'NYC OpenData / NYPD',
      'City of Chicago / CPD E-Crash',
      'Denver Police Department',
    ])
      expect(screen.getByText(source)).toBeInTheDocument();
    expect(screen.getByText('Previous 5 calendar years + current year')).toBeInTheDocument();
    expect(screen.queryByText('NHTSA FARS')).not.toBeInTheDocument();
    expect(screen.getByText('A place to work on your street')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Jurisdiction' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send setup request' })).not.toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
  it('explains concern, exploration, and brief without implying city submission', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByText('Mark the place, describe what happens, and add a photo. An observation is enough to start.')).toBeVisible();
    expect(screen.getByText('Try a street layout and see what changes. Keep estimates and open questions visible.')).toBeVisible();
    expect(screen.getByText('Download your evidence, an optional concept, and what you’re asking for in one PDF.')).toBeVisible();
    expect(screen.getByText('Adding an observation to Curbwise does not send it to a city or 311.')).not.toBeVisible();
    fireEvent.click(screen.getByText('About saving an observation'));
    expect(screen.getByText('Adding an observation to Curbwise does not send it to a city or 311.')).toBeVisible();
    expect(screen.queryByRole('link', { name: /311|sales|towns and cities|pricing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download|concept|proposal/i })).not.toBeInTheDocument();
  });
  it('opens the map and labels the design example and earlier media honestly', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/map" element={<h1>Map destination</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('img', { name: 'Illustrative Broadway street-space concept' })).toBeInTheDocument();
    expect(screen.getByText('A concept to discuss')).toBeVisible();
    expect(screen.getByText(/Original illustration only. Not to scale, a current-condition survey, or an approved project/)).toBeVisible();
    const video = screen.getByLabelText('Map and street concept demo');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).not.toHaveAttribute('loop');
    expect(video).toHaveAttribute('poster', '/demo-screenshots/08-satellite-with-proposal.png');
    expect(video.querySelector('source')).toHaveAttribute('src', '/demo-videos/curbwise-demo-compatible.mp4');
    expect(video.querySelector('source[type="video/webm"]')).toHaveAttribute('src', '/demo-videos/curbwise-demo.webm');
    expect(video).toHaveAccessibleDescription(/Earlier interface.*Crash markers are separate from community observations/);
    fireEvent.click(screen.getByText('Sources, assumptions, and open questions'));
    expect(screen.getByRole('link', { name: 'City’s Broadway corridor plan (PDF)' })).toHaveAttribute(
      'href', 'https://denvergov.org/files/assets/public/v/1/doti/documents/programsservices/denver-moves-downtown/denver-moves-downtown-broadway-central-grand.pdf',
    );
    expect(screen.getByText(/discussion questions, not field-research findings/)).toBeVisible();
    expect(screen.getByText(/engineering review, and city approval before implementation/)).toBeVisible();
    expect(screen.getByText(/bring your concern, assumptions, and requested next step into the discussion brief/)).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Start with a place' }));
    expect(screen.getByRole('heading', { name: 'Map destination' })).toBeInTheDocument();
  });
  it.each([
    ['#government', 'reporting'],
    ['#reporting', 'reporting'],
    ['#features', 'features'],
  ])('scrolls the %s deep link to useful resident guidance', (hash, targetId) => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={[`/${hash}`]}>
        <LandingPage />
      </MemoryRouter>,
    );
    act(() => vi.advanceTimersByTime(20));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    });
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0]).toHaveAttribute('id', targetId);
  });
  it('provides a keyboard skip destination and cancels pending anchor scrolling on navigation', () => {
    vi.useFakeTimers();
    const view = render(<MemoryRouter initialEntries={['/#features']}><LandingPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    view.unmount();
    act(() => vi.advanceTimersByTime(20));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
  it('tolerates an unknown anchor', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={['/#missing-section']}>
        <LandingPage />
      </MemoryRouter>,
    );
    act(() => vi.advanceTimersByTime(20));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
  it('explains public and institutional capabilities and provides sales and pricing handoffs', () => {
    render(
      <MemoryRouter>
        <InstitutionsPage />
      </MemoryRouter>,
    );
    for (const heading of [
      'What stays civic and free',
      'Town Essential',
      'City Standard and Agency Enterprise',
    ])
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Pricing' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: 'Talk to Sales' })).toHaveAttribute(
      'href',
      'mailto:sales@curbwise.dev?subject=Curbwise%20Institutional%20Pilot',
    );
  });
  it('returns a lost visitor to the map route', () => {
    render(
      <MemoryRouter initialEntries={['/missing']}>
        <Routes>
          <Route path="/missing" element={<NotFoundPage />} />
          <Route path="/map" element={<h1>Map destination</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to Map' }));
    expect(screen.getByRole('heading', { name: 'Map destination' })).toBeInTheDocument();
  });
});
