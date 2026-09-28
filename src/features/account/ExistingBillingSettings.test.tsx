import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExistingBillingSettings } from './ExistingBillingSettings';
import type { UseBillingResult } from '@/lib/api/billing';
import type { BillingState } from '@/lib/billing/types';
import { billingState } from '@/pages/__tests__/billing-fixture';

function billing(overrides: Partial<UseBillingResult> = {}): UseBillingResult {
  return {
    user: null, sessionToken: null, isLoadingAuth: false,
    billingState: billingState(), billingStateLoading: false, billingError: null,
    isStartingCheckout: false, isOpeningPortal: false,
    refreshBillingState: vi.fn().mockResolvedValue(billingState()),
    startCheckout: vi.fn().mockResolvedValue(null),
    openPortal: vi.fn().mockResolvedValue('https://billing.example/portal'),
    ...overrides,
  };
}
function paid(overrides: Partial<BillingState> = {}): BillingState {
  return billingState({ planKey: 'town_essential', status: 'active', ...overrides });
}
function expand() { fireEvent.click(screen.getByText('Billing settings')); }
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('secondary billing management', () => {
  it.each([
    {}, { billingStateLoading: true }, { isLoadingAuth: true },
    { billingState: billingState({ status: 'inactive' }) },
  ])('does not add billing or marketing for ordinary community use: %j', (overrides) => {
    const fixture = billing(overrides);
    const { container } = render(<ExistingBillingSettings billing={fixture} />);
    expect(container).toBeEmptyDOMElement();
    expect(fixture.openPortal).not.toHaveBeenCalled();
    expect(fixture.startCheckout).not.toHaveBeenCalled();
  });

  it.each([
    ['town_essential', 'Town Essential'], ['city_standard', 'City Standard'],
    ['agency_enterprise', 'Agency Enterprise'], ['civic_free', 'Civic Free'],
  ] as const)('keeps the actual existing %s plan inside a closed disclosure', (planKey, label) => {
    const fixture = billing({ billingState: paid({ planKey, customerPortalEnabled: true, billingEmail: 'billing@example.org' }) });
    render(<ExistingBillingSettings billing={fixture} />);
    const summary = screen.getByText('Billing settings');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(label)).not.toBeVisible();
    expand();
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText('billing@example.org')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeEnabled();
    expect(screen.queryByText(/Contact sales|Upgrade|Start Town|For towns|For cities|\$/i)).not.toBeInTheDocument();
    expect(fixture.startCheckout).not.toHaveBeenCalled();
  });

  it.each([
    ['none', 'No active subscription'], ['inactive', 'Inactive'], ['pending', 'Setting up'],
    ['trialing', 'Trial'], ['active', 'Active'], ['past_due', 'Payment overdue'],
    ['canceled', 'Canceled'], ['incomplete', 'Setup incomplete'], ['unpaid', 'Payment needed'],
  ] as const)('reports the recorded %s status without a marketing pitch', (status, label) => {
    render(<ExistingBillingSettings billing={billing({ billingState: paid({ status }) })} />);
    expand();
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
  });

  it.each([
    [null, 'Not scheduled'], ['not-a-date', 'Date unavailable'],
    ['2026-10-01', 'Oct 1, 2026'], ['2026-10-01T00:00:00Z', 'Oct 1, 2026'],
  ])('keeps missing and valid renewal dates understandable: %s', (currentPeriodEnd, label) => {
    render(<ExistingBillingSettings billing={billing({ billingState: paid({ currentPeriodEnd }) })} />);
    expand();
    expect(screen.getByText('Renewal date')).toBeVisible();
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText('Not provided')).toBeVisible();
    expect(screen.queryByText('not-a-date')).not.toBeInTheDocument();
  });

  it('uses the known contract date for cancellation without creating an organization setup flow', () => {
    render(<ExistingBillingSettings billing={billing({ billingState: paid({
      cancelAtPeriodEnd: true, currentPeriodEnd: '2026-10-01',
      organization: { organizationId: 'existing', organizationType: null, jurisdictionName: null, populationBand: null, contractTier: null, procurementState: null, invoiceMode: null, purchaseOrderNumber: null, contractRenewalDate: '2026-11-10' },
    }) })} />);
    expand();
    expect(screen.getByText('Access ends')).toBeVisible();
    expect(screen.getByText('Nov 10, 2026')).toBeVisible();
    expect(screen.queryByText('Oct 1, 2026')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('falls back to the subscription date when the organization has no renewal date', () => {
    render(<ExistingBillingSettings billing={billing({ billingState: paid({
      currentPeriodEnd: '2026-10-01',
      organization: { organizationId: 'existing', organizationType: null, jurisdictionName: null, populationBand: null, contractTier: null, procurementState: null, invoiceMode: null, purchaseOrderNumber: null, contractRenewalDate: null },
    }) })} />);
    expand();
    expect(screen.getByText('Oct 1, 2026')).toBeVisible();
  });

  it.each([{ billingStateLoading: true }, { isLoadingAuth: true }])('shows only a pending status for already-known billing during loading: %j', (loading) => {
    render(<ExistingBillingSettings billing={billing({ ...loading, billingState: paid({ customerPortalEnabled: true }) })} />);
    expand();
    expect(screen.getByRole('status')).toHaveTextContent('Loading billing settings');
    expect(screen.queryByText('Town Essential')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Billing settings').closest('details')).toHaveAttribute('aria-busy', 'true');
  });

  it('does not substitute a plan name if an unfamiliar existing subscription is supplied', () => {
    render(<ExistingBillingSettings billing={billing({ billingState: paid({ planKey: 'legacy_subscription' as BillingState['planKey'] }) })} />);
    expand();
    expect(screen.getByText('Existing subscription')).toBeVisible();
    expect(screen.queryByText('Civic Free')).not.toBeInTheDocument();
  });

  it('opens a truthful account-services error, prevents duplicate retry requests and disappears once free status is confirmed', async () => {
    let finish!: (state: BillingState) => void;
    const refresh = vi.fn().mockReturnValue(new Promise<BillingState>((resolve) => { finish = resolve; }));
    const fixture = billing({ billingError: 'Internal sync detail', refreshBillingState: refresh });
    const view = render(<ExistingBillingSettings billing={fixture} />);
    expect(screen.getByText('Billing settings').closest('details')).toHaveAttribute('open');
    expect(screen.getByRole('alert')).toHaveTextContent('Account services are unavailable. You can continue using community tools.');
    expect(screen.queryByText('Civic Free')).not.toBeInTheDocument();
    expect(screen.queryByText('Internal sync detail')).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Retry account services' });
    act(() => { fireEvent.click(retry); fireEvent.click(retry); });
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    await act(async () => finish(billingState()));
    view.rerender(<ExistingBillingSettings billing={{ ...fixture, billingError: null }} />);
    expect(screen.queryByText('Billing settings')).not.toBeInTheDocument();
  });

  it('keeps a failed account-services retry visible and allows another attempt', async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error('private detail')).mockResolvedValueOnce(billingState());
    const fixture = billing({ billingError: 'Unavailable', refreshBillingState: refresh });
    render(<ExistingBillingSettings billing={fixture} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry account services' }));
    expect(await screen.findByText('Account services are still unavailable. Please try again.')).toBeVisible();
    expect(screen.queryByText('private detail')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry account services' }));
    await act(async () => {});
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps an existing account-services error visible while a parent refresh is running', () => {
    render(<ExistingBillingSettings billing={billing({ billingError: 'Unavailable', billingStateLoading: true })} />);
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry account services' })).toBeDisabled();
  });

  it.each([
    [new Error('Portal temporarily unavailable'), 'Portal temporarily unavailable'],
    ['Unknown failure', 'Unable to open billing settings. Please try again.'],
    [new Error('  '), 'Unable to open billing settings. Please try again.'],
  ])('retains a portal failure and permits retry: %s', async (error, message) => {
    const openPortal = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('https://billing.example/portal');
    render(<ExistingBillingSettings billing={billing({ billingState: paid({ customerPortalEnabled: true }), openPortal })} />);
    expand();
    fireEvent.click(screen.getByRole('button', { name: 'Manage billing' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    fireEvent.click(screen.getByRole('button', { name: 'Manage billing' }));
    await act(async () => {});
    expect(openPortal).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prevents duplicate portal operations while its own request or the parent operation is pending', async () => {
    let finish!: (url: string) => void;
    const openPortal = vi.fn().mockReturnValue(new Promise<string>((resolve) => { finish = resolve; }));
    const fixture = billing({ billingState: paid({ customerPortalEnabled: true }), openPortal });
    const view = render(<ExistingBillingSettings billing={fixture} />);
    expand();
    const button = screen.getByRole('button', { name: 'Manage billing' });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(openPortal).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Opening billing…' })).toBeDisabled();
    await act(async () => finish('https://billing.example/portal'));
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeEnabled();
    view.rerender(<ExistingBillingSettings billing={{ ...fixture, isOpeningPortal: true }} />);
    expect(screen.getByRole('button', { name: 'Opening billing…' })).toBeDisabled();
  });
});
