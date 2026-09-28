import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AccountPage from '../AccountPage';

// Keep auth, billing, organization, and government hooks real. Rendering any of
// them without a Convex provider reproduces the broken local account route.
vi.mock('@/lib/api/convex-provider', () => ({ convexAvailable: false }));
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
    expect(screen.getByRole('status')).toHaveTextContent('Accounts are unavailable in this demo.');
    expect(screen.getByText(/No account, shared profile, or billing access/)).toBeInTheDocument();
    expect(screen.getByText(/disappear on reload/)).toBeInTheDocument();
    expect(screen.queryByText('Guest profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Free plan')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to map' }));
    expect(screen.getByRole('heading', { name: 'Map destination' })).toBeInTheDocument();
  },
);
