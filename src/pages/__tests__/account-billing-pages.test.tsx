import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toast';
import AccountPage from '../AccountPage';
import BillingSuccessPage from '../BillingSuccessPage';
import BillingCancelPage from '../BillingCancelPage';
import PricingPage from '../PricingPage';
import { billingState } from './billing-fixture';

const { billing, organization, hub, portal, checkout, refresh, submitLead } = vi.hoisted(() => ({
  billing: vi.fn(),
  organization: vi.fn(),
  hub: vi.fn(),
  portal: vi.fn(),
  checkout: vi.fn(),
  refresh: vi.fn(),
  submitLead: vi.fn(),
}));
vi.mock('@/lib/api/billing', () => ({ useBilling: billing }));
vi.mock('@/lib/api/organization', () => ({ useOrganizationContext: organization }));
vi.mock('@/lib/api/auth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/api/government', () => ({
  useGovernmentHub: hub,
  useGovernmentLeadSubmission: () => ({ submitLead, isSubmitting: false }),
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
    isOpeningPortal: false,
    isLoadingAuth: false,
    user: null,
  });
  organization.mockReturnValue({ organization: null, organizationLoading: false });
  hub.mockReturnValue({ hub: null, isLoading: false });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('account experience', () => {
  it('puts the guest profile and free tools first, with government setup tucked away', () => {
    billing.mockReturnValue({
      ...billing(),
      billingState: billingState({ status: 'inactive' }),
      user: { displayName: 'Urban Hawk 43', isAuthenticated: false },
    });
    organization.mockReturnValue({
      organization: { organizationType: 'individual' },
      organizationLoading: false,
    });
    render(wrap(<AccountPage />));
    expect(screen.getByRole('heading', { name: 'Your account' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Urban Hawk 43' })).toBeInTheDocument();
    expect(screen.getByText('Guest profile')).toBeInTheDocument();
    expect(screen.getByText(/It won’t carry over to other devices/)).toBeInTheDocument();
    expect(screen.getByText('Free plan')).toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Jurisdiction')).not.toBeVisible();
    expect(screen.queryByText('Backend sync')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to map' })).toHaveAttribute('href', '/map');
    expect(screen.getByRole('link', { name: /Design a better street/ })).toHaveAttribute(
      'href',
      '/editor',
    );
    expect(screen.getByRole('link', { name: /Browse community issues/ })).toHaveAttribute(
      'href',
      '/hotspots',
    );
    expect(screen.getByRole('link', { name: /Explore the map/ })).toHaveAttribute('href', '/map');
    fireEvent.click(screen.getByText('View plan details'));
    expect(screen.getByText('Private projects')).toBeVisible();
    expect(screen.getAllByText('Not included')).toHaveLength(5);
  });

  it('opens team setup on demand and retains the form draft when collapsed', () => {
    render(wrap(<AccountPage />));
    fireEvent.click(screen.getByText('For towns & cities'));
    const field = screen.getByLabelText('Jurisdiction');
    expect(field).toBeVisible();
    fireEvent.change(field, { target: { value: 'City of Boulder' } });
    fireEvent.click(screen.getByText('For towns & cities'));
    expect(field).not.toBeVisible();
    fireEvent.click(screen.getByText('For towns & cities'));
    expect(field).toBeVisible();
    expect(field).toHaveValue('City of Boulder');
  });

  it('shows an existing government workspace even before a paid plan is connected', () => {
    organization.mockReturnValue({
      organization: {
        organizationType: 'city',
        name: 'Boulder Streets',
        jurisdictionName: 'Boulder',
      },
      organizationLoading: false,
    });
    render(wrap(<AccountPage />));
    expect(screen.getByText('Your government workspace')).toBeVisible();
    expect(screen.getByText('Boulder Streets')).toBeVisible();
    expect(screen.getByLabelText('Jurisdiction')).toHaveValue('Boulder');
    expect(screen.getByText('Civic Free')).toBeVisible();
  });

  it('opens government links directly and submits their requested feature with the form', async () => {
    submitLead
      .mockRejectedValueOnce(new Error('Please try again.'))
      .mockResolvedValueOnce({ status: 'new', leadId: 'lead-1' });
    render(wrap(<AccountPage />, '/account?intent=government&feature=private_projects'));
    expect(screen.getByText(/Need private projects/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Jurisdiction'), {
      target: { value: 'City of Boulder' },
    });
    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'planner@boulder.gov' },
    });
    fireEvent.change(screen.getByLabelText('Role / Title'), { target: { value: 'Planner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Please try again.');
    expect(screen.getByLabelText('Jurisdiction')).toHaveValue('City of Boulder');
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Your request is in the onboarding queue.')).toBeVisible();
    expect(submitLead).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jurisdictionName: 'City of Boulder',
        requestedFeature: 'private projects',
        sourceSurface: 'account',
      }),
    );
  });

  it('ignores unknown feature parameters without exposing raw URL text', () => {
    render(wrap(<AccountPage />, '/account?intent=government&feature=unknown_feature'));
    expect(screen.getByLabelText('Jurisdiction')).toBeVisible();
    expect(screen.queryByText(/unknown_feature/)).not.toBeInTheDocument();
  });

  it.each([
    ['active', 'active', 'Active', 'Your government plan is active.'],
    [
      'pending',
      'pilot',
      'Pilot',
      'Your government plan is being set up. We’ll update its status here.',
    ],
    [
      'past_due',
      'outreach',
      'Outreach',
      'A payment needs attention. Review your billing details to resolve it.',
    ],
    [
      'canceled',
      'paused',
      'Paused',
      'Your government plan has ended. Public civic tools remain free.',
    ],
    ['trialing', 'unsigned', 'Unsigned', 'Your government plan is in its trial period.'],
    [
      'incomplete',
      'unsigned',
      'Unsigned',
      'Your billing setup is incomplete. Review your billing details to continue.',
    ],
    ['unpaid', 'unsigned', 'Unsigned', 'Payment is needed to restore your government plan.'],
    [
      'inactive',
      'unsigned',
      'Unsigned',
      'Your government plan is inactive. Public civic tools remain free.',
    ],
  ] as const)(
    'explains %s billing separately from %s jurisdiction coverage',
    (status, coverageStatus, coverageLabel, statusCopy) => {
      billing.mockReturnValue({
        ...billing(),
        billingState: billingState({
          planKey: 'town_essential',
          status,
          billingEmail: 'billing@city.gov',
          customerPortalEnabled: true,
          currentPeriodEnd: '2026-10-01T12:00:00Z',
          entitlements: { ...billingState().entitlements, privateProjects: true },
        }),
      });
      organization.mockReturnValue({
        organizationLoading: false,
        organization: {
          name: 'Denver Streets',
          jurisdictionName: 'Denver',
          workspaceName: 'Safety Team',
          memberRole: 'editor',
          procurementState: 'under_review',
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
            lastContactSyncAt: Date.UTC(2026, 8, 27),
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
      render(wrap(<AccountPage />));
      expect(
        within(screen.getByRole('region', { name: 'Jurisdiction coverage' })).getByText(
          coverageLabel,
        ),
      ).toBeVisible();
      expect(screen.getByText(statusCopy)).toBeVisible();
      fireEvent.click(screen.getByText('View plan details'));
      expect(screen.getByText('Oct 1, 2026')).toBeVisible();
      expect(screen.getByText('Denver Streets')).toBeVisible();
      expect(screen.getByText('Under review')).toBeVisible();
      expect(
        screen.getByText(status === 'active' ? 'Submitted 1 time' : 'Submitted 2 times'),
      ).toBeVisible();
      expect(screen.getByLabelText('Jurisdiction')).toHaveValue('Denver');
      expect(screen.getByLabelText('Role / Title')).toHaveValue('Planner');
    },
  );

  it('keeps missing organization details honest and shows cancellation dates and enabled tools', () => {
    billing.mockReturnValue({
      ...billing(),
      user: { displayName: 'Avery Chen', email: 'avery@city.gov', isAuthenticated: true },
      billingState: billingState({
        planKey: 'city_standard',
        status: 'active',
        cancelAtPeriodEnd: true,
        organization: {
          organizationId: 'org-1',
          organizationType: 'city',
          jurisdictionName: null,
          populationBand: null,
          contractTier: 'city_standard',
          procurementState: null,
          purchaseOrderNumber: null,
          contractRenewalDate: '2026-11-10',
          invoiceMode: 'purchase_order',
        },
        entitlements: {
          ...billingState().entitlements,
          publicIssueReports: false,
          publicHotspots: false,
          publicProposals: false,
          reviewThreads: true,
          approvalStates: true,
          billingAdmin: true,
          auditLogs: true,
        },
      }),
    });
    render(wrap(<AccountPage />));
    expect(screen.getByText('Signed in')).toBeVisible();
    expect(screen.getByText('avery@city.gov')).toBeVisible();
    expect(screen.queryByText(/It won’t carry over/)).not.toBeInTheDocument();
    expect(screen.queryByText('Report street issues')).not.toBeInTheDocument();
    expect(screen.getByText('Not assigned')).toBeVisible();
    expect(screen.getByText('Purchase order')).toBeVisible();
    expect(screen.getByText('Not updated yet')).toBeVisible();
    fireEvent.click(screen.getByText('View plan details'));
    expect(screen.getByText('Access ends')).toBeVisible();
    expect(screen.getByText('Nov 10, 2026')).toBeVisible();
    expect(screen.getByText('Not provided')).toBeVisible();
  });

  it('uses the latest request to prefill a team that has no organization yet', () => {
    hub.mockReturnValue({
      isLoading: false,
      hub: {
        latestLead: {
          jurisdictionName: 'Boulder',
          roleTitle: 'Engineer',
          workEmail: 'engineer@boulder.gov',
          status: 'new',
          submissionCount: 1,
        },
      },
    });
    render(wrap(<AccountPage />));
    expect(screen.getByLabelText('Jurisdiction')).toHaveValue('Boulder');
    expect(screen.getByLabelText('Role / Title')).toHaveValue('Engineer');
    expect(screen.getByText('Not assigned')).toBeVisible();
  });

  it('shows loading placeholders without declaring a free plan or an active contract', () => {
    billing.mockReturnValue({
      ...billing(),
      isLoadingAuth: true,
      billingStateLoading: true,
      billingState: billingState({ planKey: 'town_essential' }),
    });
    organization.mockReturnValue({ organization: null, organizationLoading: true });
    hub.mockReturnValue({ hub: null, isLoading: true });
    render(wrap(<AccountPage />));
    expect(screen.getByText('Loading your profile…')).toBeVisible();
    expect(screen.getByText('Loading your plan…')).toBeInTheDocument();
    expect(screen.queryByText('Civic Free')).not.toBeInTheDocument();
    expect(screen.getAllByText('Loading…')).toHaveLength(2);
  });

  it('makes billing load failures retryable instead of presenting the fallback free plan as fact', () => {
    billing.mockReturnValue({ ...billing(), billingError: 'Sync failed' });
    render(wrap(<AccountPage />));
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your plan. Sync failed');
    expect(screen.queryByText('Civic Free')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ['invalid-contract-date', 'invalid-contract-date'],
    [null, 'Not scheduled'],
  ])('keeps renewal value %s understandable', (date, text) => {
    billing.mockReturnValue({
      ...billing(),
      billingState: billingState({ planKey: 'town_essential', currentPeriodEnd: date }),
    });
    render(wrap(<AccountPage />));
    fireEvent.click(screen.getByText('View plan details'));
    expect(screen.getByText(text)).toBeVisible();
  });

  it('exposes organization provisioning failure', () => {
    organization.mockReturnValue({
      organization: null,
      organizationLoading: false,
      organizationError: 'Organization setup could not be completed.',
    });
    render(wrap(<AccountPage />));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Organization setup could not be completed.',
    );
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
    await act(async () => {});
    expect(portal).toHaveBeenCalledTimes(2);
  });

  it('prevents repeat portal requests while opening billing', async () => {
    let finish!: () => void;
    portal.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    billing.mockReturnValue({
      ...billing(),
      billingState: billingState({ customerPortalEnabled: true }),
    });
    const { rerender } = render(wrap(<AccountPage />));
    fireEvent.click(screen.getByRole('button', { name: 'Manage billing' }));
    expect(screen.getByRole('button', { name: 'Opening billing…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Opening billing…' }));
    expect(portal).toHaveBeenCalledOnce();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeEnabled();
    billing.mockReturnValue({ ...billing(), isOpeningPortal: true });
    rerender(wrap(<AccountPage />));
    expect(screen.getByRole('button', { name: 'Opening billing…' })).toBeDisabled();
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
