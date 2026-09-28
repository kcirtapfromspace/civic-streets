import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AccountPage from '../AccountPage';
import { useProposalStore } from '@/stores/proposal-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';

// Keep auth, billing, organization, and government hooks real. Rendering any of
// them without a Convex provider reproduces the broken local account route.
vi.mock('@/lib/api/convex-provider', () => ({ convexAvailable: false }));
beforeEach(() => {
  localStorage.clear();
  useProposalStore.setState(useProposalStore.getInitialState());
  useIntersectionStore.setState(useIntersectionStore.getInitialState());
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  useSavedProposalsStore.setState(useSavedProposalsStore.getInitialState());
});
afterEach(cleanup);

it.each(['/account', '/account?intent=government&feature=private_projects'])(
  'renders %s without a backend or provider, without inventing an account',
  (route) => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/map" element={<h1>Map destination</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Your account' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Accounts are unavailable in this demo.',
    );
    expect(screen.getByText('Fictional posts reset on reload. Nothing is published.')).toBeVisible();
    expect(screen.getByText(/Saved in this browser/)).toBeVisible();
    expect(screen.queryByText('Guest profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Free plan')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Example observations' })).toHaveAttribute(
      'href',
      '/hotspots',
    );
    expect(screen.getByRole('button', { name: 'My work (0)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('link', { name: 'Back to map' }));
    expect(screen.getByRole('heading', { name: 'Map destination' })).toBeInTheDocument();
  },
);

it('lets a demo visitor create a durable private concern without an account or backend', () => {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/map" element={<h1>Map destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'My work (0)' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Describe the place' }), {
    target: { value: 'Library entrance' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'New private concern' }));
  expect(screen.getByRole('heading', { name: 'Map destination' })).toBeVisible();
  expect(Object.values(useWorkDraftsStore.getState().drafts)).toEqual([
    expect.objectContaining({ name: 'Library entrance', location: null }),
  ]);
});
