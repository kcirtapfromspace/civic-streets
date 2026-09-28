import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toast';
import BillingSuccessPage from '../BillingSuccessPage';
import BillingCancelPage from '../BillingCancelPage';
import PricingPage from '../PricingPage';
import { billingState } from './billing-fixture';

const { billing, portal, checkout, refresh } = vi.hoisted(() => ({
  billing: vi.fn(),
  portal: vi.fn(),
  checkout: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/lib/api/convex-provider', () => ({ convexAvailable: true }));
vi.mock('@/lib/api/billing', () => ({ useBilling: billing }));
vi.mock('@/lib/api/auth', () => ({ useAuth: () => ({ user: null }) }));
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
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
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
