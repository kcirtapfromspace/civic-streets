import { useRef, useState } from 'react';
import type { UseBillingResult } from '@/lib/api/billing';
import type { BillingStatus } from '@/lib/billing/types';
import { getPlanByKey } from '@/lib/billing/plans';

const STATUS_LABELS: Record<BillingStatus, string> = {
  none: 'No active subscription',
  inactive: 'Inactive',
  pending: 'Setting up',
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Payment overdue',
  canceled: 'Canceled',
  incomplete: 'Setup incomplete',
  unpaid: 'Payment needed',
};

function formatDate(value: string | null): string {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Secondary management for existing subscriptions; community participation has no upsell. */
export function ExistingBillingSettings({ billing }: { billing: UseBillingResult }) {
  const { billingState, billingStateLoading, isLoadingAuth, billingError, isOpeningPortal } = billing;
  const [pending, setPending] = useState<'portal' | 'refresh' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestPending = useRef(false);
  const hasExistingBilling = billingState.planKey !== 'civic_free' || billingState.customerPortalEnabled;

  async function runAction(action: 'portal' | 'refresh') {
    if (requestPending.current) return;
    requestPending.current = true;
    setPending(action);
    setActionError(null);
    try {
      if (action === 'portal') await billing.openPortal();
      else await billing.refreshBillingState();
    } catch (error) {
      setActionError(action === 'portal'
        ? error instanceof Error && error.message.trim() ? error.message : 'Unable to open billing settings. Please try again.'
        : 'Account services are still unavailable. Please try again.');
    } finally {
      requestPending.current = false;
      setPending(null);
    }
  }

  // Loading a default free state is not evidence of a subscription. Keep the
  // community page usable while its separate account services are resolving.
  if (!hasExistingBilling && !billingError) return null;
  const loading = billingStateLoading || isLoadingAuth;
  const openingPortal = pending === 'portal' || isOpeningPortal;
  const renewalDate = billingState.organization?.contractRenewalDate ?? billingState.currentPeriodEnd;
  const dateLabel = billingState.cancelAtPeriodEnd || billingState.status === 'canceled' ? 'Access ends' : 'Renewal date';

  return <details className="account-billing" open={Boolean(billingError)} aria-busy={loading || pending !== null}>
    <summary className="min-h-11 cursor-pointer content-center py-3 text-sm font-semibold text-civic-ink">Billing settings</summary>
    <div className="space-y-4 pb-4 text-sm text-civic-ink">
      {billingError ? <div className="space-y-3">
        <p role="alert">{actionError || 'Account services are unavailable. You can continue using community tools.'}</p>
        <button type="button" className="min-h-11 rounded border border-civic-line px-4 font-medium hover:bg-civic-wash disabled:opacity-60" disabled={loading || pending !== null} onClick={() => void runAction('refresh')}>
          {pending === 'refresh' ? 'Retrying…' : 'Retry account services'}
        </button>
      </div> : loading ? <p role="status" className="text-civic-muted">Loading billing settings…</p> : <>
        <dl className="account-detail-list">
          <div><dt>Subscription</dt><dd>{getPlanByKey(billingState.planKey)?.name ?? 'Existing subscription'}</dd></div>
          <div><dt>Status</dt><dd>{STATUS_LABELS[billingState.status]}</dd></div>
          <div><dt>{dateLabel}</dt><dd>{formatDate(renewalDate)}</dd></div>
          <div><dt>Billing email</dt><dd>{billingState.billingEmail || 'Not provided'}</dd></div>
        </dl>
        <p className="text-xs text-civic-muted">Dates are shown in UTC.</p>
        {billingState.customerPortalEnabled && <button type="button" className="min-h-11 rounded border border-civic-line px-4 font-medium hover:bg-civic-wash disabled:opacity-60" onClick={() => void runAction('portal')} disabled={openingPortal}>
          {openingPortal ? 'Opening billing…' : 'Manage billing'}
        </button>}
        {actionError && <p role="alert">{actionError}</p>}
      </>}
    </div>
  </details>;
}
