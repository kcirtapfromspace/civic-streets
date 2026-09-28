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
  it('offers a short introduction and working routes into the community', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'What would you change on your street?',
    );
    expect(screen.getByRole('link', { name: 'Open the map' })).toHaveAttribute('href', '/map');
    expect(screen.getByRole('link', { name: 'Community observations' })).toHaveAttribute('href', '/hotspots');
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
    expect(screen.queryByRole('link', { name: /sales|towns and cities|pricing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Street concept example' })).not.toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
  it('uses the current recording with user-controlled playback and a matching poster', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const video = screen.getByLabelText('Street idea walkthrough');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).not.toHaveAttribute('loop');
    expect(video).toHaveAttribute('poster', '/demo-screenshots/community-workflow.jpg');
    expect(video.querySelectorAll('source')).toHaveLength(2);
    expect(video.querySelector('source[type="video/webm"]')).toHaveAttribute('src', '/demo-videos/community-workflow.webm');
    expect(video.querySelector('source[type="video/mp4"]')).toHaveAttribute('src', '/demo-videos/community-workflow.mp4');
    expect(video).toHaveAccessibleDescription(/current interface.*nothing is published/);
    expect(screen.queryByText(/Earlier interface/)).not.toBeInTheDocument();
  });
  it.each([
    ['Open the map', '/map', 'Map destination'],
    ['Community observations', '/hotspots', 'Community destination'],
    ['Account', '/account', 'Account destination'],
  ])('opens %s from the home page', (label, path, destination) => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path={path} element={<h1>{destination}</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: label }));
    expect(screen.getByRole('heading', { name: destination })).toBeVisible();
  });
  it.each([
    ['#government', 'main-content'],
    ['#reporting', 'main-content'],
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
