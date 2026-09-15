import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '../LandingPage';
import InstitutionsPage from '../InstitutionsPage';
import NotFoundPage from '../NotFoundPage';

vi.mock('@/lib/api/auth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/api/government', () => ({
  useGovernmentLeadSubmission: () => ({ submitLead: vi.fn(), isSubmitting: false }),
}));
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('public pages', () => {
  it('offers the live map and describes the three connected crash datasets accurately', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Find the dangerous block.',
    );
    expect(
      screen.getAllByRole('link').filter((link) => link.getAttribute('href') === '/map').length,
    ).toBeGreaterThan(0);
    for (const source of [
      'NYC OpenData / NYPD',
      'City of Chicago / CPD E-Crash',
      'Denver Police Department',
    ])
      expect(screen.getByText(source)).toBeInTheDocument();
    expect(screen.getByText('Previous 5 calendar years + current year')).toBeInTheDocument();
    expect(screen.queryByText('NHTSA FARS')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Jurisdiction' })).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
  it('scrolls a government deep link into view and tolerates an unknown anchor', () => {
    vi.useFakeTimers();
    const first = render(
      <MemoryRouter initialEntries={['/#government']}>
        <LandingPage />
      </MemoryRouter>,
    );
    act(() => vi.advanceTimersByTime(20));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    first.unmount();
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
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
