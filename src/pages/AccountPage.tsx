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
          <div>
            <p className="account-eyebrow">Curbwise community</p>
            <h1>Your account</h1>
            <p>Pick up an idea. See what neighbors are noticing.</p>
          </div>
          <Link className="account-text-link" to="/map">
            Back to map <span aria-hidden="true">↗</span>
          </Link>
        </header>

        {demo ? (
          <section className="account-profile" aria-label="Demo access">
            <ProfileMark />
            <div className="account-profile-copy">
              <h2>Try the community tools</h2>
              <p role="status">Community accounts are unavailable in this demo.</p>
            </div>
            <span className="account-status">Local demo</span>
            <p className="account-session-note">
              Example observations are fictional and demo posts disappear on reload. Your private
              drafts in My work stay in this browser. Nothing is published or sent to a city.
            </p>
          </section>
        ) : (
          profile
        )}

        <div className="account-content-grid">
          <section className="account-work" aria-labelledby="account-work-heading">
            <p className="account-kicker">Start small. Come back to it.</p>
            <h2 id="account-work-heading">Your private drafts</h2>
            <p className="account-work-intro">
              A concern, a street idea, a better crossing. Keep working on it here, at your own
              pace.
            </p>
            <div className="account-work-trigger">
              <SavedDrafts inline onOpenWork={() => navigate('/map')} />
            </div>
            <p className="account-work-hint">
              Open My work to resume a draft or start with a few words about a place.
            </p>
            <div className="account-storage-note">
              <span aria-hidden="true">↳</span>
              <p>
                Saved on this browser, including after reload. Clearing browser data removes drafts.
                Download a brief when you want a copy to keep or share.
              </p>
            </div>
          </section>

          <nav className="account-actions" aria-labelledby="account-actions-heading">
            <h2 id="account-actions-heading">Take part in your neighborhood</h2>
            <p>One useful observation is a good place to start.</p>
            <AccountAction
              to="/hotspots"
              title={demo ? 'Explore example observations' : 'Explore community observations'}
              description={
                demo
                  ? 'Try reading and responding to a sample concern.'
                  : 'Read what others notice. Add context or join a discussion.'
              }
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
              description="Explore a block or return to a layout you’re working on."
              icon={
                <>
                  <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
                  <path d="M9 10h6M12 7v6" />
                </>
              }
            />
            <AccountAction
              to="/editor"
              title="Sketch a street idea"
              description="Explore a different layout and make a brief to discuss."
              icon={
                <>
                  <path d="m4 16-1 5 5-1L21 7l-4-4L4 16Z" />
                  <path d="m14 6 4 4M4 16l4 4" />
                </>
              }
            />
          </nav>
        </div>

        <section className="account-sharing" aria-labelledby="account-sharing-heading">
          <h2 id="account-sharing-heading">Share when you’re ready</h2>
          <div className="account-sharing-grid">
            <div>
              <h3>A draft is yours to work on</h3>
              <p>
                Writing a concern or making a concept doesn’t publish it. Downloading a brief
                doesn’t send it to anyone.
              </p>
            </div>
            <div>
              <h3>A post starts a conversation</h3>
              <p>
                {demo
                  ? 'In the connected community, posted observations and comments are public. This demo lets you try the steps without publishing.'
                  : 'Observations and comments you post are public. Describe the place, what you saw, and what would help so others can add their perspective.'}
              </p>
            </div>
          </div>
        </section>

        {settings}
        <footer className="account-footer">
          <span>Community tools are free to use.</span>
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
                  ? 'Your name when you take part in the community'
                  : 'Your private drafts are still available below.'}
            </p>
          </>
        )}
      </div>
      {!loading && user && (
        <span className="account-status">
          {user.isAuthenticated ? 'Signed in' : 'Guest profile'}
        </span>
      )}
      {!loading && user && !user.isAuthenticated && (
        <p className="account-session-note">
          You can take part without signing up. This guest profile is linked to this browser; it
          won’t follow you to another device. Private drafts also stay on this browser.
        </p>
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
