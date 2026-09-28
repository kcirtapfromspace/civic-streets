import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useBilling } from '@/lib/api/billing';
import { convexAvailable } from '@/lib/api/convex-provider';
import { useOrganizationContext } from '@/lib/api/organization';
import { useGovernmentHub } from '@/lib/api/government';
import { useToast } from '@/components/ui/Toast';
import { BILLING_FEATURE_LABELS, type BillingFeatureKey } from '@/lib/billing/access';
import type { BillingStatus } from '@/lib/billing/types';
import { getPlanByKey } from '@/lib/billing/plans';
import { GovernmentLeadForm } from '@/features/government/GovernmentLeadForm';
import './account.css';

const BILLING_STATUS: Record<BillingStatus, { label: string; description: string }> = {
  none: {
    label: 'Free plan',
    description: 'Your everyday tools for better streets. No subscription needed.',
  },
  inactive: {
    label: 'Inactive',
    description: 'Your government plan is inactive. Public civic tools remain free.',
  },
  pending: {
    label: 'Setting up',
    description: 'Your government plan is being set up. We’ll update its status here.',
  },
  trialing: { label: 'Trial', description: 'Your government plan is in its trial period.' },
  active: { label: 'Active', description: 'Your government plan is active.' },
  past_due: {
    label: 'Payment overdue',
    description: 'A payment needs attention. Review your billing details to resolve it.',
  },
  canceled: {
    label: 'Canceled',
    description: 'Your government plan has ended. Public civic tools remain free.',
  },
  incomplete: {
    label: 'Setup incomplete',
    description: 'Your billing setup is incomplete. Review your billing details to continue.',
  },
  unpaid: {
    label: 'Payment needed',
    description: 'Payment is needed to restore your government plan.',
  },
};

function formatDate(value: string | null): string {
  if (!value) return 'Not scheduled';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function readableStatus(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export default function AccountPage() {
  return convexAvailable ? <ConnectedAccountPage /> : <DemoAccountPage />;
}

function DemoAccountPage() {
  return (
    <div className="min-h-full bg-[#f3f5f5] px-5 py-10 text-[#172126] sm:py-16">
      <section
        className="mx-auto max-w-xl rounded-lg border border-[#d8dddf] bg-white p-6 sm:p-8"
        aria-labelledby="demo-account-heading"
      >
        <h1 id="demo-account-heading" className="text-2xl font-semibold tracking-tight">
          Your account
        </h1>
        <p role="status" className="mt-5 text-sm font-semibold">
          Accounts are unavailable in this demo.
        </p>
        <p className="mt-2 text-sm leading-6 text-[#59646a]">
          This demo is not connected to the community service. No account, shared profile, or
          billing access is available here.
        </p>
        <p className="mt-3 text-sm leading-6 text-[#59646a]">
          You can still explore the map and try marking a problem. Demo records stay in this browser
          session and disappear on reload.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#172126] px-4 text-sm font-semibold text-white hover:bg-[#303d43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172126]"
          to="/map"
        >
          Back to map
        </Link>
      </section>
    </div>
  );
}

function ConnectedAccountPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const {
    user,
    isLoadingAuth,
    billingState,
    billingStateLoading,
    billingError,
    isOpeningPortal,
    openPortal,
    refreshBillingState,
  } = useBilling();
  const { organization, organizationLoading, organizationError } = useOrganizationContext({
    bootstrapIfMissing: true,
  });
  const { hub, isLoading: governmentHubLoading } = useGovernmentHub();
  const [portalPending, setPortalPending] = useState(false);
  const governmentIntent = searchParams.get('intent') === 'government';
  const feature = searchParams.get('feature');
  const requestedFeatureKey =
    feature && Object.prototype.hasOwnProperty.call(BILLING_FEATURE_LABELS, feature)
      ? (feature as BillingFeatureKey)
      : undefined;
  const isFreePlan = billingState.planKey === 'civic_free';
  const planStatus =
    BILLING_STATUS[isFreePlan && billingState.status === 'inactive' ? 'none' : billingState.status];
  const hasGovernmentDetails =
    !isFreePlan ||
    Boolean(hub?.coverage || hub?.latestLead) ||
    Boolean(organization && organization.organizationType !== 'individual');
  const displayName = user?.displayName || 'Community member';
  const coverageLabel = hub?.coverage ? readableStatus(hub.coverage.status) : 'Not connected';
  const renewalDate =
    billingState.organization?.contractRenewalDate ?? billingState.currentPeriodEnd;

  const handleManageBilling = async () => {
    setPortalPending(true);
    try {
      await openPortal();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to open billing portal', 'error');
    } finally {
      setPortalPending(false);
    }
  };

  return (
    <div className="account-page">
      <div className="account-shell">
        <header className="account-heading">
          <div>
            <p className="account-eyebrow">A little care. Better streets.</p>
            <h1>Your account</h1>
            <p>Your place in the Curbwise community.</p>
          </div>
          <Link className="account-text-link" to="/map">
            Back to map <span aria-hidden="true">↗</span>
          </Link>
        </header>

        <section className="account-profile" aria-label="Your profile" aria-busy={isLoadingAuth}>
          <div className="account-avatar" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="m7 25 5-18h8l5 18M16 10v3m0 4v3m0 4v1"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="account-profile-copy">
            {isLoadingAuth ? (
              <p className="account-loading" role="status">
                Loading your profile…
              </p>
            ) : (
              <h2>{displayName}</h2>
            )}
            <p>{user?.isAuthenticated ? user.email : 'Your community profile on this browser'}</p>
          </div>
          <span className="account-status">
            {user?.isAuthenticated ? 'Signed in' : 'Guest profile'}
          </span>
          {!user?.isAuthenticated && (
            <p className="account-session-note">
              No sign-up needed. Keep using this browser to return to your profile. It won’t carry
              over to other devices.
            </p>
          )}
        </section>

        {organizationError && (
          <p role="alert" className="account-alert">
            {organizationError}
          </p>
        )}

        <div className="account-content-grid">
          <section
            className="account-plan account-panel"
            aria-labelledby="account-plan-heading"
            aria-busy={billingStateLoading}
          >
            <div className="account-section-heading">
              <h2 id="account-plan-heading">Your plan</h2>
              {!billingStateLoading && !billingError && (
                <span className={`account-status ${isFreePlan ? 'account-status-blue' : ''}`}>
                  {planStatus.label}
                </span>
              )}
            </div>
            {billingStateLoading ? (
              <div className="account-plan-loading" role="status">
                <span className="account-skeleton account-skeleton-title" />
                <span className="account-skeleton" />
                <span className="sr-only">Loading your plan…</span>
              </div>
            ) : billingError ? (
              <div className="account-plan-error">
                <p role="alert">We couldn’t load your plan. {billingError}</p>
                <Button onClick={() => void refreshBillingState()}>Try again</Button>
              </div>
            ) : (
              <>
                <div className="account-plan-title">
                  <h3>{getPlanByKey(billingState.planKey)?.name}</h3>
                  {isFreePlan && (
                    <span>
                      $0 <span>/ always</span>
                    </span>
                  )}
                </div>
                <p className="account-plan-description">{planStatus.description}</p>
                <ul className="account-included" aria-label="Included in your plan">
                  {[
                    ['Report street issues', billingState.entitlements.publicIssueReports],
                    [
                      'Create and share public proposals',
                      billingState.entitlements.publicProposals,
                    ],
                    ['Explore community hotspots', billingState.entitlements.publicHotspots],
                  ]
                    .filter(([, enabled]) => enabled)
                    .map(([label]) => (
                      <li key={String(label)}>
                        <span aria-hidden="true">✓</span>
                        {label}
                      </li>
                    ))}
                </ul>
                <details className="account-details account-plan-details">
                  <summary>
                    View plan details <Chevron />
                  </summary>
                  <dl className="account-detail-list">
                    {[
                      ['Public civic workflows', billingState.entitlements.publicHotspots],
                      ['Private projects', billingState.entitlements.privateProjects],
                      ['Review threads', billingState.entitlements.reviewThreads],
                      ['Approval states', billingState.entitlements.approvalStates],
                      ['Billing admin', billingState.entitlements.billingAdmin],
                      ['Audit logs', billingState.entitlements.auditLogs],
                    ].map(([label, enabled]) => (
                      <DetailRow
                        key={String(label)}
                        label={String(label)}
                        value={enabled ? 'Included' : 'Not included'}
                      />
                    ))}
                    {(!isFreePlan || billingState.customerPortalEnabled || renewalDate) && (
                      <>
                        <DetailRow
                          label={billingState.cancelAtPeriodEnd ? 'Access ends' : 'Renewal'}
                          value={formatDate(renewalDate)}
                        />
                        <DetailRow
                          label="Billing email"
                          value={billingState.billingEmail ?? 'Not provided'}
                        />
                      </>
                    )}
                  </dl>
                </details>
                {billingState.customerPortalEnabled && (
                  <Button
                    className="account-billing-button"
                    onClick={() => void handleManageBilling()}
                    disabled={portalPending || isOpeningPortal}
                  >
                    {portalPending || isOpeningPortal ? 'Opening billing…' : 'Manage billing'}
                  </Button>
                )}
              </>
            )}
          </section>

          <nav className="account-actions" aria-labelledby="account-actions-heading">
            <h2 id="account-actions-heading">Make a difference</h2>
            <p>Small steps toward safer streets.</p>
            <AccountAction
              to="/map"
              title="Explore the map"
              description="See what’s happening on your streets."
              icon={
                <>
                  <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" />
                  <path d="M9 3v16M15 5v16" />
                </>
              }
            />
            <AccountAction
              to="/editor"
              title="Design a better street"
              description="Turn an idea into a street proposal."
              icon={
                <>
                  <path d="m4 16-1 5 5-1L21 7l-4-4L4 16Z" />
                  <path d="m14 6 4 4M4 16l4 4" />
                </>
              }
            />
            <AccountAction
              to="/hotspots"
              title="Browse community issues"
              description="Find concerns and add your support."
              icon={
                <>
                  <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </>
              }
            />
          </nav>
        </div>

        <details
          id="government-contact"
          className="account-details account-government"
          open={governmentIntent || hasGovernmentDetails}
        >
          <summary>
            <span className="account-government-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 9 9-6 9 6H3ZM5 10v8m7-8v8m7-8v8M3 21h18" />
              </svg>
            </span>
            <span className="account-government-title">
              {hasGovernmentDetails ? 'Your government workspace' : 'For towns & cities'}
              <span>Private workspaces, team reviews, and tools for public agencies.</span>
            </span>
            <span className="account-government-cta">
              {hasGovernmentDetails ? 'View details' : 'Set up a team'}
            </span>
            <Chevron />
          </summary>
          <div className="account-government-body">
            {governmentIntent && requestedFeatureKey && (
              <p className="account-intent-note">
                Need {BILLING_FEATURE_LABELS[requestedFeatureKey]}? Tell us about your team below.
              </p>
            )}
            {hasGovernmentDetails && (
              <div className="account-government-grid">
                <section aria-label="Organization details">
                  <h3>Organization</h3>
                  <dl className="account-detail-list">
                    <DetailRow
                      label="Name"
                      value={
                        organizationLoading ? 'Loading…' : (organization?.name ?? 'Not set up yet')
                      }
                    />
                    <DetailRow
                      label="Jurisdiction"
                      value={
                        organization?.jurisdictionName ??
                        hub?.latestLead?.jurisdictionName ??
                        'Not connected'
                      }
                    />
                    <DetailRow
                      label="Workspace"
                      value={organization?.workspaceName ?? 'Not set up yet'}
                    />
                    <DetailRow
                      label="Your role"
                      value={
                        organization?.memberRole
                          ? readableStatus(organization.memberRole)
                          : 'Not assigned'
                      }
                    />
                    <DetailRow
                      label="Procurement"
                      value={readableStatus(organization?.procurementState ?? 'none')}
                    />
                    <DetailRow
                      label="Billing method"
                      value={readableStatus(
                        billingState.organization?.invoiceMode ??
                          organization?.invoiceMode ??
                          'self_serve',
                      )}
                    />
                  </dl>
                </section>
                <section aria-label="Jurisdiction coverage">
                  <h3>Jurisdiction coverage</h3>
                  <dl className="account-detail-list">
                    <DetailRow
                      label="Status"
                      value={governmentHubLoading ? 'Loading…' : coverageLabel}
                    />
                    <DetailRow
                      label="Jurisdiction"
                      value={hub?.coverage?.displayName ?? 'Not connected'}
                    />
                    <DetailRow
                      label="Official contacts"
                      value={String(hub?.coverage?.contactCount ?? 0)}
                    />
                    <DetailRow
                      label="Up-to-date contacts"
                      value={String(hub?.coverage?.freshContactCount ?? 0)}
                    />
                    <DetailRow
                      label="Last updated"
                      value={
                        hub?.coverage?.lastContactSyncAt
                          ? new Date(hub.coverage.lastContactSyncAt).toLocaleDateString('en-US')
                          : 'Not updated yet'
                      }
                    />
                  </dl>
                </section>
              </div>
            )}
            {hub?.latestLead && (
              <section className="account-request" aria-label="Latest setup request">
                <div>
                  <h3>Latest request · {hub.latestLead.jurisdictionName}</h3>
                  <p>
                    {hub.latestLead.roleTitle} · {hub.latestLead.workEmail}
                  </p>
                </div>
                <span className="account-status">{readableStatus(hub.latestLead.status)}</span>
                <p>
                  Submitted {hub.latestLead.submissionCount} time
                  {hub.latestLead.submissionCount === 1 ? '' : 's'}
                </p>
              </section>
            )}
            <GovernmentLeadForm
              sourceSurface="account"
              requestedFeature={requestedFeatureKey}
              title="Let’s set up your team"
              description="Tell us a little about your jurisdiction. We’ll help you find the right setup."
              submitLabel="Send request"
              className="rounded-none! border-0! bg-transparent! p-0! shadow-none! backdrop-blur-none!"
              initialJurisdictionName={
                organization?.jurisdictionName ?? hub?.latestLead?.jurisdictionName ?? ''
              }
              initialRoleTitle={hub?.latestLead?.roleTitle ?? ''}
              initialPopulationBand={organization?.populationBand ?? null}
            />
          </div>
        </details>
        <footer className="account-footer">
          <span>Better streets start with you.</span>
          <Link className="account-text-link" to="/">
            About Curbwise <span aria-hidden="true">↗</span>
          </Link>
        </footer>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Chevron() {
  return (
    <svg className="account-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AccountAction({
  to,
  title,
  description,
  icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link className="account-action" to={to}>
      <span className="account-action-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </span>
      <span>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="account-action-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
