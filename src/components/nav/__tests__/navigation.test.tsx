import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../Layout';
import { ToastProvider } from '@/components/ui/Toast';
import { useWorkspaceStore } from '@/stores/workspace-store';

beforeEach(() => useWorkspaceStore.setState(useWorkspaceStore.getInitialState()));
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
            <Route path="/hotspots" element={<h1>Community reports</h1>} />
          </Route>
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('application navigation', () => {
  it('links the Map tab to the actual workspace and highlights the active page', () => {
    render(<Navigation path="/account" />);
    expect(screen.getByRole('main')).toHaveClass('pb-14');
    const tabs = screen.getByRole('navigation', { name: 'Tab navigation' });
    expect(within(tabs).getByRole('link', { name: 'Account' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(within(tabs).getByRole('link', { name: 'Map' }));
    expect(screen.getByRole('heading', { name: 'Map workspace' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveClass('pb-14');
    expect(within(tabs).getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/map');
    act(() => useWorkspaceStore.setState({ mode: 'design' }));
    expect(screen.queryByRole('navigation', { name: 'Tab navigation' })).not.toBeInTheDocument();
  });
  it('opens and closes the mobile menu after navigation and exposes notification feedback', () => {
    render(<Navigation />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByRole('status')).toHaveTextContent('No new notifications');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    const mobile = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(mobile).getByRole('link', { name: 'Map' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(within(mobile).getByRole('link', { name: 'Editor' }));
    expect(screen.getByRole('heading', { name: 'Street editor' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
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
});
