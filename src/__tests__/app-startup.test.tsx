import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import ReactDOM, { type Root } from 'react-dom/client';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { billingState } from '@/pages/__tests__/billing-fixture';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCommunityStore } from '@/features/community/community-store';
import { useExplorerStore } from '@/features/community/explorer-store';
import { useReportStore } from '@/features/report/report-store';
import { mapFixture } from '@/features/community/__tests__/map-fixture';

const { backend, auth, provider, refresh } = vi.hoisted(() => ({
  backend: { available: true },
  auth: vi.fn(),
  provider: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/lib/api/convex-provider', () => ({
  get convexAvailable() {
    return backend.available;
  },
  ConvexClientProvider: ({ children }: { children: ReactNode }) => {
    provider();
    return children;
  },
}));
vi.mock('@/lib/api/auth', () => ({ useAuth: auth }));
vi.mock('@/lib/api/use-hotspots', async (original) => ({
  ...(await original<object>()),
  useHotspotById: () => ({ hotspot: null, isLoading: false }),
  useHotspotsList: () => ({ hotspots: [], isLoading: false }),
}));
vi.mock('@/lib/api/government', () => ({
  useGovernmentHub: () => ({ hub: null, isLoading: false }),
  useGovernmentLeadSubmission: () => ({ submitLead: vi.fn(), isSubmitting: false }),
}));
vi.mock('@/lib/api/organization', () => ({
  useOrganizationContext: () => ({
    organization: null,
    organizationLoading: false,
    organizationError: null,
  }),
}));
vi.mock('@/lib/api/billing', () => ({
  useBilling: () => ({
    billingState: billingState(),
    billingStateLoading: false,
    refreshBillingState: refresh,
    openPortal: vi.fn(),
    startCheckout: vi.fn(),
  }),
}));
vi.mock('convex/react', async (original) => ({
  ...(await original<object>()),
  useQuery: () => null,
}));
vi.mock('@/lib/api/use-service-areas', () => ({
  useServiceAreas: () => [],
  useHotspotsByServiceArea: () => [],
}));
vi.mock('@/lib/api/geocoding', () => ({ searchPlaces: vi.fn() }));
vi.mock('maplibre-gl', async () => ({
  default: (await import('@/features/community/__tests__/map-fixture')).maplibreFixture,
}));
// WebGL is a browser port; the real MapPage lazy loader and all route/page/layout components run.
vi.mock('@/features/map/MapView', () => ({ MapView: () => <h1>Interactive map</h1> }));

beforeEach(() => {
  vi.clearAllMocks();
  backend.available = true;
  auth.mockReturnValue({ user: null, isLoading: false });
  useStreetStore.setState(useStreetStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useCommunityStore.setState(useCommunityStore.getInitialState());
  useExplorerStore.setState(useExplorerStore.getInitialState());
  useReportStore.getState().reset();
  mapFixture.reset();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  Element.prototype.scrollIntoView = vi.fn();
  window.history.replaceState({}, '', '/');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function visit(path: string, expectedHeading: string | RegExp) {
  window.history.replaceState({}, '', path);
  const view = render(<App />);
  expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument();
  return view;
}

describe('application routes with real page boundaries', () => {
  it('loads the marketing page without application navigation, then opens the live map through its CTA', async () => {
    await visit('/', /Find the dangerous block/);
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/map')!,
    );
    expect(await screen.findByRole('heading', { name: 'Interactive map' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/map');
  });
  it.each(['/pricing', '/institutions'])(
    'redirects the legacy %s entry to the government onboarding section',
    async (path) => {
      await visit(path, /Find the dangerous block/);
      expect(window.location.pathname + window.location.hash).toBe('/#government');
      await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    },
  );
  it('loads the street editor and the parameterized saved-design entry point', async () => {
    window.history.replaceState({}, '', '/editor');
    const first = render(<App />);
    expect(await screen.findByLabelText('Street Name')).toHaveValue('Main Street');
    first.unmount();
    window.history.replaceState({}, '', '/editor/shared-concept');
    render(<App />);
    expect(await screen.findByText('Loading design shared-concept...')).toBeInTheDocument();
  });
  it('loads the community explorer and reports missing detail identities without crashing', async () => {
    window.history.replaceState({}, '', '/hotspots');
    const first = render(<App />);
    expect(await screen.findAllByRole('heading', { name: 'Community Hotspots' })).toHaveLength(2);
    first.unmount();
    await visit('/hotspot/unknown', 'Hotspot Not Found');
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
  it.each(['/report', '/report/saved-concept'])(
    'loads the editable representative draft at %s',
    async (path) => {
      await visit(path, 'Share with Your Representatives');
      expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('');
    },
  );
  it.each([
    ['/account', 'Jurisdiction status'],
    ['/billing/success', 'Contract sync in progress'],
    ['/billing/cancel', 'Onboarding request canceled'],
    ['/institutional/denver-streets', 'Denver Streets Dashboard'],
  ])('loads %s inside the application navigation', async (path, heading) => {
    await visit(path, heading);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });
  it('bootstraps auth only with a configured backend and returns unknown routes to the map', async () => {
    backend.available = false;
    const first = await visit('/unknown', 'Page Not Found');
    expect(auth).not.toHaveBeenCalled();
    first.unmount();
    backend.available = true;
    await visit('/another-unknown', 'Page Not Found');
    expect(auth).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Back to Map' }));
    expect(await screen.findByRole('heading', { name: 'Interactive map' })).toBeInTheDocument();
  });
});

it('mounts the real app through the production root and backend provider', async () => {
  window.history.replaceState({}, '', '/startup-not-found');
  const host = document.createElement('div');
  host.id = 'root';
  document.body.appendChild(host);
  const createRoot = ReactDOM.createRoot;
  const roots: Root[] = [];
  const rootSpy = vi.spyOn(ReactDOM, 'createRoot').mockImplementation((container, options) => {
    const root = createRoot(container, options);
    roots.push(root);
    return root;
  });
  try {
    await act(async () => {
      await import('../main');
    });
    expect(await screen.findByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    expect(rootSpy).toHaveBeenCalledOnce();
    expect(rootSpy).toHaveBeenCalledWith(host);
    expect(provider).toHaveBeenCalled();
    expect(auth).toHaveBeenCalled();
    expect(host).toContainElement(screen.getByRole('navigation', { name: 'Main navigation' }));
  } finally {
    act(() => roots.forEach((root) => root.unmount()));
    host.remove();
  }
});
