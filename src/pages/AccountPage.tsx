import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBilling, type UseBillingResult } from '@/lib/api/billing';
import { convexAvailable } from '@/lib/api/convex-provider';
import { SavedDrafts } from '@/features/proposal/SavedDrafts';
import { ExistingBillingSettings } from '@/features/account/ExistingBillingSettings';
import './account.css';

export default function AccountPage() {
  return convexAvailable ? <ConnectedAccountPage /> : <CommunityAccount demo />;
}

function ConnectedAccountPage() {
  const billing = useBilling();
  return (
    <CommunityAccount
      profile={<CommunityProfile user={billing.user} loading={billing.isLoadingAuth} />}
      settings={<ExistingBillingSettings billing={billing} />}
    />
  );
}

function CommunityAccount({
  demo = false,
  profile,
  settings,
}: {
  demo?: boolean;
  profile?: ReactNode;
  settings?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="account-page">
      <div className="account-shell">
        <header className="account-heading">
          <h1>Your account</h1>
          <Link className="account-text-link" to="/map">
            Back to map <span aria-hidden="true">↗</span>
          </Link>
        </header>

        {demo ? (
          <section className="account-profile" aria-label="Demo access">
            <ProfileMark />
            <div className="account-profile-copy">
              <h2>Local demo</h2>
              <p role="status">Accounts are unavailable in this demo.</p>
            </div>
          </section>
        ) : (
          profile
        )}

        <div className="account-content-grid">
          <section className="account-work" aria-labelledby="account-work-heading">
            <h2 id="account-work-heading">Your drafts</h2>
            <p className="account-work-intro">
              Start an idea or pick up where you left off.
            </p>
            <div className="account-work-trigger">
              <SavedDrafts inline onOpenWork={() => navigate('/map')} />
            </div>
            <p className="account-storage-note">
              Saved in this browser. Clearing browser data removes drafts.
            </p>
          </section>

          <nav className="account-actions" aria-labelledby="account-actions-heading">
            <h2 id="account-actions-heading">Get involved</h2>
            <AccountAction
              to="/hotspots"
              title={demo ? 'Example observations' : 'Community observations'}
              icon={
                <>
                  <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z" />
                  <path d="M8 10h8M8 14h5" />
                </>
              }
            />
            <AccountAction
              to="/map"
              title="Open the map"
              icon={
                <>
                  <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
                  <path d="M9 10h6M12 7v6" />
                </>
              }
            />
            <AccountAction
              to="/editor"
              title="Sketch a street"
              icon={
                <>
                  <path d="m4 16-1 5 5-1L21 7l-4-4L4 16Z" />
                  <path d="m14 6 4 4M4 16l4 4" />
                </>
              }
            />
          </nav>
        </div>

        <p className="account-sharing">
          {demo
            ? 'Fictional posts reset on reload. Nothing is published.'
            : 'Drafts stay private. Posts and comments are public.'}
        </p>

        {settings}
        <footer className="account-footer">
          <span>Free community tools.</span>
          <Link className="account-text-link" to="/">
            About Curbwise <span aria-hidden="true">↗</span>
          </Link>
        </footer>
      </div>
    </div>
  );
}

function CommunityProfile({ user, loading }: { user: UseBillingResult['user']; loading: boolean }) {
  return (
    <section className="account-profile" aria-label="Your community profile" aria-busy={loading}>
      <ProfileMark />
      <div className="account-profile-copy">
        {loading ? (
          <p role="status">Loading your profile…</p>
        ) : (
          <>
            <h2>
              {user ? user.displayName || 'Community member' : 'Community profile unavailable'}
            </h2>
            <p>
              {user?.isAuthenticated
                ? user.email
                : user
                  ? 'This profile stays in this browser.'
                  : 'Your drafts are still available.'}
            </p>
          </>
        )}
      </div>
      {!loading && user && (
        <span className="account-status">
          {user.isAuthenticated ? 'Signed in' : 'Guest profile'}
        </span>
      )}
    </section>
  );
}

function ProfileMark() {
  return (
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
  );
}

function AccountAction({
  to,
  title,
  icon,
}: {
  to: string;
  title: string;
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
      <strong>{title}</strong>
      <span className="account-action-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
