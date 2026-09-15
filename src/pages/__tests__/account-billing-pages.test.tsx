import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toast';
import AccountPage from '../AccountPage';
import BillingSuccessPage from '../BillingSuccessPage';
import BillingCancelPage from '../BillingCancelPage';
import PricingPage from '../PricingPage';
import { billingState } from './billing-fixture';

const { billing, organization, hub, portal, checkout, refresh } = vi.hoisted(() => ({
  billing: vi.fn(),
  organization: vi.fn(),
  hub: vi.fn(),
  portal: vi.fn(),
  checkout: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/lib/api/billing', () => ({ useBilling: billing }));
vi.mock('@/lib/api/organization', () => ({ useOrganizationContext: organization }));
vi.mock('@/lib/api/auth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/api/government', () => ({
  useGovernmentHub: hub,
  useGovernmentLeadSubmission: () => ({ submitLead: vi.fn(), isSubmitting: false }),
}));
function wrap(page: React.ReactNode, path = '/account') {
  return (
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>{page}</ToastProvider>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  billing.mockReturnValue({
    billingState: billingState(),
    billingStateLoading: false,
    billingError: null,
    openPortal: portal,
    startCheckout: checkout,
    refreshBillingState: refresh,
    isStartingCheckout: false,
  });
  organization.mockReturnValue({ organization: null, organizationLoading: false });
  hub.mockReturnValue({ hub: null, isLoading: false });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('account contract and coverage state', () => {
  it('shows public access and unsigned coverage without suggesting an unprovisioned contract is live', () => {
    render(wrap(<AccountPage />, '/account?intent=government'));
    expect(screen.getByRole('heading', { name: 'Jurisdiction status' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Public civic access is active. Government onboarding has not been provisioned yet.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Unsigned')).toHaveLength(2);
    expect(screen.getByText('Not synced')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Map' })).toHaveAttribute('href', '/map');
    expect(screen.getByText('Not provisioned yet')).toBeInTheDocument();
  });
  it.each([
    ['active', 'active', 'Active', 'Contract billing is live.'],
    ['pending', 'pilot', 'Pilot', 'Provisioning is still syncing.'],
    ['past_due', 'outreach', 'Outreach', 'There is a billing issue to resolve.'],
    ['canceled', 'paused', 'Paused', 'Contract access is not currently active.'],
  ] as const)(
    'distinguishes %s billing from %s jurisdiction coverage',
    (status, coverageStatus, coverageLabel, statusCopy) => {
      billing.mockReturnValue({
        ...billing(),
        billingState: billingState({
          planKey: 'town_essential',
          status,
          billingEmail: 'billing@city.gov',
          customerPortalEnabled: true,
          currentPeriodEnd: '2026-10-01T12:00:00Z',
        }),
      });
      organization.mockReturnValue({
        organizationLoading: false,
        organization: {
          name: 'Denver Streets',
          jurisdictionName: 'Denver',
          workspaceName: 'Safety Team',
          memberRole: 'editor',
          procurementState: 'review',
          invoiceMode: 'invoice',
          populationBand: 'over_500k_or_regional',
        },
      });
      hub.mockReturnValue({
        isLoading: false,
        hub: {
          coverage: {
            status: coverageStatus,
            displayName: 'Denver',
            contactCount: 5,
            freshContactCount: 3,
            lastContactSyncAt: Date.now(),
          },
          latestLead: {
            jurisdictionName: 'Denver',
            roleTitle: 'Planner',
            workEmail: 'planner@city.gov',
            status: 'review',
            submissionCount: status === 'active' ? 1 : 2,
          },
        },
      });
      render(wrap(<AccountPage />, '/account?intent=government&feature=private_projects'));
      expect(screen.getAllByText(coverageLabel)).toHaveLength(2);
      expect(screen.getByText(statusCopy)).toBeInTheDocument();
      expect(screen.getByText('Oct 1, 2026')).toBeInTheDocument();
      expect(screen.getByText('Denver Streets')).toBeInTheDocument();
      expect(screen.getByText(/Need private projects/)).toBeInTheDocument();
      expect(
        screen.getByText(status === 'active' ? 'Submitted 1 time' : 'Submitted 2 times'),
      ).toBeInTheDocument();
    },
  );
  it('shows loading/error state and keeps malformed renewal dates visible for review', () => {
    billing.mockReturnValue({
      ...billing(),
      billingStateLoading: true,
      billingError: 'Sync failed',
      billingState: billingState({ currentPeriodEnd: 'invalid-contract-date' }),
    });
    organization.mockReturnValue({ organization: null, organizationLoading: true });
    hub.mockReturnValue({ hub: null, isLoading: true });
    render(wrap(<AccountPage />));
    expect(screen.getAllByText('Loading...')).toHaveLength(3);
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByText('invalid-contract-date')).toBeInTheDocument();
  });
  it('exposes organization provisioning failure instead of leaving the account silently unprovisioned', () => {
    organization.mockReturnValue({
      organization: null,
      organizationLoading: false,
      organizationError: 'Organization setup could not be completed.',
    });
    render(wrap(<AccountPage />));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Organization setup could not be completed.',
    );
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
  it.each([
    [new Error('Portal temporarily unavailable'), 'Portal temporarily unavailable'],
    ['unknown', 'Unable to open billing portal'],
  ])('keeps portal failures visible and retryable', async (error, message) => {
    portal.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    billing.mockReturnValue({
      ...billing(),
      billingState: billingState({ customerPortalEnabled: true }),
    });
    render(wrap(<AccountPage />));
    fireEvent.click(screen.getByRole('button', { name: 'Manage billing' }));
    expect(await screen.findByRole('status')).toHaveTextContent(message);
    fireEvent.click(screen.getByRole('button', { name: 'Manage billing' }));
    expect(portal).toHaveBeenCalledTimes(2);
  });
});

describe('billing return pages', () => {
  it('polls pending state, waits for paid active access, then redirects and cleans up its timers', () => {
    vi.useFakeTimers();
    billing.mockReturnValue({ ...billing(), billingStateLoading: true });
    const page = (
      <MemoryRouter initialEntries={['/billing/success']}>
        <Routes>
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/account" element={<h1>Account destination</h1>} />
        </Routes>
      </MemoryRouter>
    );
    const { rerender } = render(page);
    expect(screen.getByText('Refreshing billing state...')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Map' })).toHaveAttribute('href', '/map');
    act(() => vi.advanceTimersByTime(2500));
    expect(refresh).toHaveBeenCalledOnce();
    billing.mockReturnValue({
      ...billing(),
      billingStateLoading: false,
      billingState: billingState({ planKey: 'town_essential', status: 'pending' }),
    });
    rerender(page);
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.queryByRole('heading', { name: 'Account destination' })).not.toBeInTheDocument();
    billing.mockReturnValue({
      ...billing(),
      billingState: billingState({ planKey: 'town_essential', status: 'active' }),
    });
    rerender(
      <MemoryRouter initialEntries={['/billing/success']}>
        <Routes>
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/account" element={<h1>Account destination</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByRole('heading', { name: 'Account destination' })).toBeInTheDocument();
    const count = refresh.mock.calls.length;
    act(() => vi.advanceTimersByTime(5000));
    expect(refresh).toHaveBeenCalledTimes(count);
  });
  it('allows a manual account return and explains that cancellation made no contract changes', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/billing/success']}>
        <Routes>
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/account" element={<h1>Account destination</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go to Account' }));
    expect(screen.getByRole('heading', { name: 'Account destination' })).toBeInTheDocument();
    unmount();
    render(wrap(<BillingCancelPage />));
    expect(
      screen.getByRole('heading', { name: 'Onboarding request canceled' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Account' })).toHaveAttribute(
      'href',
      '/account',
    );
  });
});

describe('legacy pricing page', () => {
  it.each([
    ['pdf_export', 'Branded PDF export starts on Town Essential'],
    ['premium_templates', 'Advanced templates are part of government plans'],
    ['private_projects', 'Private projects require a government workspace'],
    ['report_pdf_attachment', 'Report attachments require branded export access'],
    ['review_threads', 'Internal review starts on the government plans'],
    ['approval_states', 'Approval states start on City Standard'],
    ['member_roles', 'Role-based access starts on City Standard'],
    ['audit_logs', 'Audit logs are part of Agency Enterprise'],
  ])('explains the requested %s capability', (feature, title) => {
    render(wrap(<PricingPage />, `/pricing?feature=${feature}`));
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Current Plan' })).toBeDisabled();
  });
  it('shows loading and current-paid plan states and protects checkout while already in progress', () => {
    billing.mockReturnValue({ ...billing(), billingStateLoading: true, isStartingCheckout: true });
    const { rerender } = render(wrap(<PricingPage />));
    expect(screen.getByText('Loading billing state...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Town Essential' })).toBeDisabled();
    billing.mockReturnValue({
      ...billing(),
      billingStateLoading: false,
      billingState: billingState({ planKey: 'town_essential', status: 'active' }),
    });
    rerender(wrap(<PricingPage />));
    expect(screen.getByText('Your billing state is active.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Current Plan' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Keep Using Civic Free' })).toHaveAttribute(
      'href',
      '/map',
    );
  });
  it.each([
    [new Error('Checkout unavailable'), new Error('Portal unavailable')],
    ['checkout failed', 'portal failed'],
  ])('surfaces checkout and portal failures', async (checkoutError, portalError) => {
    checkout.mockRejectedValue(checkoutError);
    portal.mockRejectedValue(portalError);
    billing.mockReturnValue({
      ...billing(),
      billingState: billingState({ customerPortalEnabled: true }),
    });
    render(wrap(<PricingPage />));
    fireEvent.click(screen.getByRole('button', { name: 'Start Town Essential' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    await act(async () => {});
    expect(screen.getAllByRole('status')[1]).toHaveTextContent(
      portalError instanceof Error ? portalError.message : 'Unable to open billing portal',
    );
  });
  it('starts the requested billing operation and encodes a sales contact subject at the browser boundary', async () => {
    checkout.mockResolvedValue(undefined);
    portal.mockResolvedValue(undefined);
    billing.mockReturnValue({
      ...billing(),
      billingState: billingState({ customerPortalEnabled: true }),
    });
    const location = { href: '' };
    const browser = window;
    vi.stubGlobal(
      'window',
      new Proxy(browser, {
        get(target, property) {
          return property === 'location' ? location : Reflect.get(target, property, target);
        },
      }),
    );
    render(wrap(<PricingPage />));
    fireEvent.click(screen.getByRole('button', { name: 'Start Town Essential' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    await act(async () => {});
    expect(checkout).toHaveBeenCalledOnce();
    expect(portal).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Contact Sales' }));
    expect(location.href).toBe(
      'mailto:sales@curbwise.dev?subject=Curbwise%20Institutional%20Pilot',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Sales' }));
    expect(location.href).toContain('City%20Standard');
  });
});
