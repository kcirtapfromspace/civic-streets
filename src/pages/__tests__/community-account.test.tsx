import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AccountPage from '../AccountPage';
import { billingState } from './billing-fixture';
import { useProposalStore } from '@/stores/proposal-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkDraftsStore, WORK_DRAFTS_KEY } from '@/stores/work-drafts-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

const { billing, organization, government } = vi.hoisted(() => ({
  billing: vi.fn(),
  organization: vi.fn(),
  government: vi.fn(),
}));
vi.mock('@/lib/api/convex-provider', () => ({ convexAvailable: true }));
vi.mock('@/lib/api/billing', () => ({ useBilling: billing }));
vi.mock('@/lib/api/organization', () => ({ useOrganizationContext: organization }));
vi.mock('@/lib/api/government', () => ({ useGovernmentHub: government }));

function page(route = '/account') {
  return (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/map" element={<h1>Map destination</h1>} />
        <Route path="/hotspots" element={<h1>Community destination</h1>} />
        <Route path="/editor" element={<h1>Street editor destination</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  useProposalStore.setState(useProposalStore.getInitialState());
  useIntersectionStore.setState(useIntersectionStore.getInitialState());
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  useSavedProposalsStore.setState(useSavedProposalsStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  billing.mockReturnValue({
    user: { displayName: 'Urban Hawk 43', isAuthenticated: false },
    isLoadingAuth: false,
    billingState: billingState(),
    billingStateLoading: false,
    billingError: null,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([
  '/account',
  '/account?intent=government&feature=private_projects',
  '/account?feature=unknown_feature',
])('makes %s a community workspace without sales or organization creation', (route) => {
  render(page(route));
  expect(screen.getByRole('heading', { name: 'Urban Hawk 43' })).toBeVisible();
  expect(screen.getByText('Guest profile')).toBeVisible();
  expect(screen.getByText('This profile stays in this browser.')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Your drafts' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Get involved' })).toBeVisible();
  expect(
    screen.queryByText(/For towns|Your plan|Set up a team|Not included|Civic Free|unknown_feature/),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Jurisdiction')).not.toBeInTheDocument();
  expect(organization).not.toHaveBeenCalled();
  expect(government).not.toHaveBeenCalled();
  expect(screen.getByText(/Clearing browser data removes drafts/)).toBeVisible();
  expect(screen.getByText('Drafts stay private. Posts and comments are public.')).toBeVisible();
});

it('keeps drafts accessible while a profile is loading or unavailable, without inventing a guest', () => {
  billing.mockReturnValue({ ...billing(), user: null, isLoadingAuth: true });
  const view = render(page());
  expect(screen.getByRole('status')).toHaveTextContent('Loading your profile');
  expect(screen.queryByText('Guest profile')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'My work (0)' })).toBeEnabled();
  billing.mockReturnValue({ ...billing(), isLoadingAuth: false });
  view.rerender(page());
  expect(screen.getByRole('heading', { name: 'Community profile unavailable' })).toBeVisible();
  expect(screen.queryByText('Guest profile')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'My work (0)' }));
  expect(screen.getByRole('textbox', { name: 'Describe the place' })).toBeEnabled();
});

it('shows a verified identity without implying that private drafts sync to its account', () => {
  billing.mockReturnValue({
    ...billing(),
    user: { displayName: '', email: 'resident@example.org', isAuthenticated: true },
  });
  render(page());
  expect(screen.getByRole('heading', { name: 'Community member' })).toBeVisible();
  expect(screen.getByText('resident@example.org')).toBeVisible();
  expect(screen.getByText('Signed in')).toBeVisible();
  expect(screen.queryByText('This profile stays in this browser.')).not.toBeInTheDocument();
  expect(screen.getByText(/Saved in this browser/)).toBeVisible();
});

it('opens existing saved work with its identity and purpose intact', () => {
  useProposalStore.getState().initConcern('Elm Street crossing');
  useProposalStore
    .getState()
    .setBriefContext({
      concern: 'The crossing is hard to see',
      requestedNextStep: 'Discuss better lighting',
    });
  useProposalStore.getState().saveWork();
  const id = useProposalStore.getState().proposalId;
  useProposalStore.setState(useProposalStore.getInitialState());
  render(page());
  fireEvent.click(screen.getByRole('button', { name: 'My work (1)' }));
  fireEvent.click(screen.getByRole('button', { name: /Reopen Elm Street crossing/ }));
  expect(screen.getByRole('heading', { name: 'Map destination' })).toBeVisible();
  expect(useProposalStore.getState()).toMatchObject({
    proposalId: id,
    briefContext: {
      concern: 'The crossing is hard to see',
      requestedNextStep: 'Discuss better lighting',
    },
  });
  expect(useWorkspaceStore.getState().mode).toBe('propose');
});

it('preserves current work and the new place when storage fails, then permits retry', () => {
  useProposalStore.getState().initConcern('Existing concern');
  render(page());
  fireEvent.click(screen.getByRole('button', { name: 'My work (1)' }));
  const modal = within(screen.getByRole('dialog'));
  fireEvent.change(modal.getByRole('textbox', { name: 'Describe the place' }), {
    target: { value: 'School gate' },
  });
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage full');
  });
  fireEvent.click(modal.getByRole('button', { name: 'New private concern' }));
  expect(modal.getByRole('textbox', { name: 'Describe the place' })).toHaveValue('School gate');
  expect(modal.getByRole('alert')).toBeVisible();
  expect(useProposalStore.getState().streetName).toBe('Existing concern');
  expect(screen.queryByRole('heading', { name: 'Map destination' })).not.toBeInTheDocument();
  write.mockRestore();
  fireEvent.click(modal.getByRole('button', { name: 'New private concern' }));
  expect(screen.getByRole('heading', { name: 'Map destination' })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(WORK_DRAFTS_KEY)!).drafts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Existing concern' }),
      expect.objectContaining({ name: 'School gate' }),
    ]),
  );
});

it.each([
  ['Community observations', 'Community destination'],
  ['Open the map', 'Map destination'],
  ['Sketch a street', 'Street editor destination'],
])('takes the member from %s to its working destination', (link, destination) => {
  render(page());
  fireEvent.click(screen.getByRole('link', { name: new RegExp(link) }));
  expect(screen.getByRole('heading', { name: destination })).toBeVisible();
});
