import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../Layout';
import { ToastProvider } from '@/components/ui/Toast';
import { useWorkspaceStore } from '@/stores/workspace-store';

const backend = vi.hoisted(() => ({ connected: true }));
vi.mock('@/lib/api/convex-provider', () => ({ get convexAvailable() { return backend.connected; } }));
beforeEach(() => {
  backend.connected = true;
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
});
afterEach(cleanup);
function Navigation({ path = '/map' }: { path?: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/map" element={<h1>Map workspace</h1>} />
            <Route path="/editor" element={<h1>Street editor</h1>} />
            <Route path="/account" element={<h1>Account settings</h1>} />
            <Route path="/hotspots" element={<h1>Observations</h1>} />
          </Route>
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('application navigation', () => {
  it('links the Map tab to the actual workspace and highlights the active page', () => {
    render(<Navigation path="/account" />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    const tabs = screen.getByRole('navigation', { name: 'Tab navigation' });
    expect(within(tabs).getByRole('link', { name: 'Account' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(within(tabs).getByRole('link', { name: 'Map' }));
    expect(screen.getByRole('heading', { name: 'Map workspace' })).toBeInTheDocument();
    expect(within(tabs).getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/map');
    act(() => useWorkspaceStore.setState({ mode: 'design' }));
    expect(screen.queryByRole('navigation', { name: 'Tab navigation' })).not.toBeInTheDocument();
  });
  it('opens and closes the mobile menu after navigation without a fake notification control', () => {
    render(<Navigation />);
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    const mobile = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(mobile).getAllByRole('link').map((link) => link.textContent)).toEqual(['Map', 'Observations', 'Street concepts', 'Account']);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', mobile.id);
    expect(within(mobile).getByRole('link', { name: 'Map' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(within(mobile).getByRole('link', { name: 'Street concepts' }));
    expect(screen.getByRole('heading', { name: 'Street editor' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', {
        name: 'Account',
      }),
    );
    expect(screen.getByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
  });
  it('closes the mobile menu with Escape and returns focus to its toggle', () => {
    render(<Navigation />);
    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    fireEvent.click(toggle);
    const mobile = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const concerns = within(mobile).getByRole('link', { name: 'Observations' });
    concerns.focus();
    fireEvent.keyDown(concerns, { key: 'Tab' });
    expect(mobile).toBeInTheDocument();
    fireEvent.keyDown(concerns, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
  it('uses resident-facing labels while preserving the existing routes', () => {
    render(<Navigation />);
    for (const name of ['Main navigation', 'Tab navigation']) {
      const navigation = screen.getByRole('navigation', { name });
      expect(within(navigation).getAllByRole('link').slice(0, 3).map((link) => link.textContent)).toEqual(['Map', 'Observations', 'Street concepts']);
      expect(within(navigation).getByRole('link', { name: 'Street concepts' })).toHaveAttribute('href', '/editor');
      expect(within(navigation).getByRole('link', { name: 'Observations' })).toHaveAttribute('href', '/hotspots');
    }
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Tab navigation' })).getByRole('link', { name: 'Observations' }));
    expect(screen.getByRole('heading', { name: 'Observations' })).toBeInTheDocument();
  });
});

it('labels the entire offline workspace as fictional and browser-session-only', () => {
  backend.connected = false;
  render(<Navigation />);
  const banner = screen.getByRole('complementary', { name: 'Demo mode' });
  expect(banner).toHaveTextContent('Example reports and activity are fictional');
  expect(banner).toHaveTextContent('disappear on reload');
  expect(banner).toHaveTextContent('Nothing is published or submitted to a city');
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Tab navigation' })).getByRole('link', { name: 'Observations' }));
  expect(banner).toBeInTheDocument();
});

it('does not label connected community records as fictional', () => {
  render(<Navigation />);
  expect(screen.queryByRole('complementary', { name: 'Demo mode' })).not.toBeInTheDocument();
});
