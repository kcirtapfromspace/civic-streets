import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button } from '@/components/ui';
import { useBilling } from '@/lib/api/billing';
import { useOrganizationContext } from '@/lib/api/organization';
import { useGovernmentHub } from '@/lib/api/government';
import { useToast } from '@/components/ui/Toast';
import {
  BILLING_FEATURE_LABELS,
  hasActiveBillingStatus,
  type BillingFeatureKey,
} from '@/lib/billing/access';
import { getPlanByKey } from '@/lib/billing/plans';
import { GovernmentLeadForm } from '@/features/government/GovernmentLeadForm';

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCoverageStatus(value: string | null | undefined): string {
  switch (value) {
    case 'pilot':
      return 'Pilot';
    case 'active':
      return 'Active';
    case 'outreach':
      return 'Outreach';
    case 'paused':
      return 'Paused';
    default:
      return 'Unsigned';
  }
}

function getCoverageBadgeVariant(value: string | null | undefined) {
  if (value === 'active' || value === 'pilot') return 'success' as const;
  if (value === 'outreach') return 'warning' as const;
  if (value === 'paused') return 'default' as const;
  return 'default' as const;
}

function getBillingStatusCopy(status: ReturnType<typeof useBilling>['billingState']['status']): string {
  if (status === 'active' || status === 'trialing') {
    return 'Contract billing is live.';
  }
  if (status === 'pending') {
    return 'Provisioning is still syncing.';
  }
  if (status === 'past_due') {
    return 'There is a billing issue to resolve.';
  }
  if (status === 'canceled') {
    return 'Contract access is not currently active.';
  }
  return 'Public civic access is active. Government onboarding has not been provisioned yet.';
}

export default function AccountPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { billingState, billingStateLoading, billingError, openPortal } = useBilling();
  const { organization, organizationLoading } = useOrganizationContext({
    bootstrapIfMissing: true,
  });
  const { hub, isLoading: governmentHubLoading } = useGovernmentHub();

  const currentPlan = getPlanByKey(billingState.planKey);
  const hasLivePaidPlan = hasActiveBillingStatus(billingState.status);
  const requestedFeatureKey = searchParams.get('feature') as BillingFeatureKey | null;
  const requestedFeatureLabel = requestedFeatureKey
    ? BILLING_FEATURE_LABELS[requestedFeatureKey]
    : null;

  const handleManageBilling = async () => {
    try {
      await openPortal();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Unable to open billing portal',
        'error',
      );
    }
  };

  return (
    <div className="min-h-full bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a,#1e293b_55%,#334155)] px-6 py-7 text-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                    Account
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Jurisdiction status
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-white/72">
                    Manage contract state, jurisdiction coverage, and onboarding
                    requests from one place.
                  </p>
                </div>
                <Badge variant={hasLivePaidPlan ? 'success' : 'default'}>
                  {billingState.status}
                </Badge>
              </div>

              {searchParams.get('intent') === 'government' && (
                <div className="mt-5 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm text-white/88 backdrop-blur">
                  {requestedFeatureLabel
                    ? `Need ${requestedFeatureLabel}? Tell us about the jurisdiction and we will scope the right setup.`
                    : 'Tell us about the jurisdiction and the workflow you need. We will follow up directly.'}
                </div>
              )}
            </div>

            <div className="px-6 py-6">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Current plan"
                  value={billingStateLoading ? 'Loading...' : currentPlan?.name ?? 'Civic Free'}
                  detail={getBillingStatusCopy(billingState.status)}
                />
                <MetricCard
                  label="Coverage"
                  value={
                    governmentHubLoading
                      ? 'Loading...'
                      : formatCoverageStatus(hub?.coverage?.status)
                  }
                  detail={
                    hub?.coverage?.displayName
                      ? hub.coverage.displayName
                      : 'No jurisdiction linked yet'
                  }
                />
                <MetricCard
                  label="Procurement"
                  value={organization?.procurementState ?? 'none'}
                  detail={
                    billingState.organization?.invoiceMode ??
                    organization?.invoiceMode ??
                    'self_serve'
                  }
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InfoCard
                  title="Organization"
                  rows={[
                    ['Organization', organizationLoading ? 'Loading...' : organization?.name ?? 'Not provisioned yet'],
                    ['Jurisdiction', organization?.jurisdictionName ?? hub?.latestLead?.jurisdictionName ?? 'Not set'],
                    ['Workspace', organization?.workspaceName ?? 'Shared Workspace'],
                    ['Role', organization?.memberRole ?? 'owner'],
                  ]}
                />
                <InfoCard
                  title="Contract"
                  rows={[
                    ['Renewal', formatDate(billingState.organization?.contractRenewalDate ?? billingState.currentPeriodEnd)],
                    ['Billing email', billingState.billingEmail ?? 'Pending provisioning'],
                    ['Portal', billingState.customerPortalEnabled ? 'Enabled' : 'Not enabled'],
                    ['Backend sync', billingError ? 'Needs review' : 'Healthy'],
                  ]}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {billingState.customerPortalEnabled && (
                  <Button variant="primary" onClick={() => void handleManageBilling()}>
                    Manage billing
                  </Button>
                )}
                <Link to="/map">
                  <Button variant="secondary">Back to Map</Button>
                </Link>
                <Link to="/#government">
                  <Button variant="ghost">Landing government section</Button>
                </Link>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Jurisdiction coverage
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Coverage status is explicit. Unsigned jurisdictions route
                    resident actions into the outreach queue.
                  </p>
                </div>
                <Badge variant={getCoverageBadgeVariant(hub?.coverage?.status)}>
                  {formatCoverageStatus(hub?.coverage?.status)}
                </Badge>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <CoverageRow
                  label="Contacts cached"
                  value={String(hub?.coverage?.contactCount ?? 0)}
                />
                <CoverageRow
                  label="Fresh official contacts"
                  value={String(hub?.coverage?.freshContactCount ?? 0)}
                />
                <CoverageRow
                  label="Last sync"
                  value={
                    hub?.coverage?.lastContactSyncAt
                      ? new Date(hub.coverage.lastContactSyncAt).toLocaleDateString()
                      : 'Not synced'
                  }
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Entitlements
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <EntitlementRow label="Public civic workflows" enabled={billingState.entitlements.publicHotspots} />
                <EntitlementRow label="Private projects" enabled={billingState.entitlements.privateProjects} />
                <EntitlementRow label="Review threads" enabled={billingState.entitlements.reviewThreads} />
                <EntitlementRow label="Approval states" enabled={billingState.entitlements.approvalStates} />
                <EntitlementRow label="Billing admin" enabled={billingState.entitlements.billingAdmin} />
                <EntitlementRow label="Audit logs" enabled={billingState.entitlements.auditLogs} />
              </div>
            </section>

            {hub?.latestLead && (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Latest request
                </p>
                <p className="mt-3 text-sm font-medium text-slate-900">
                  {hub.latestLead.jurisdictionName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {hub.latestLead.roleTitle} · {hub.latestLead.workEmail}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="info">{hub.latestLead.status}</Badge>
                  <span className="text-xs text-slate-500">
                    Submitted {hub.latestLead.submissionCount} time{hub.latestLead.submissionCount === 1 ? '' : 's'}
                  </span>
                </div>
              </section>
            )}
          </aside>
        </div>

        <div id="government-contact" className="mt-8">
          <GovernmentLeadForm
            sourceSurface="account"
            requestedFeature={requestedFeatureKey ?? undefined}
            title="Request municipal onboarding"
            description="Need private workspaces, branded exports, or internal review? Send the jurisdiction details here and Curbwise will follow up."
            initialJurisdictionName={
              organization?.jurisdictionName ?? hub?.latestLead?.jurisdictionName ?? ''
            }
            initialRoleTitle={hub?.latestLead?.roleTitle ?? ''}
            initialPopulationBand={organization?.populationBand ?? null}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-stone-50 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function InfoCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-stone-50 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-medium text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function EntitlementRow({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <Badge variant={enabled ? 'success' : 'default'}>
        {enabled ? 'On' : 'Off'}
      </Badge>
    </div>
  );
}
