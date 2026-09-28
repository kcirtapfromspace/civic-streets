import { NavLink, Link } from 'react-router-dom';
import { useId, useRef, useState } from 'react';

const navLinks = [
  { to: '/map', label: 'Map', icon: MapPinIcon },
  { to: '/hotspots', label: 'Observations', icon: ConcernIcon },
  { to: '/editor', label: 'Street concepts', icon: PencilRulerIcon },
] as const;

export function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header
      className="relative z-50 flex min-h-14 shrink-0 items-center gap-4 border-b border-civic-line bg-civic-paper px-4 text-civic-ink sm:px-6"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setMobileMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      {/* Brand */}
      <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2 md:mr-5" aria-label="Curbwise home">
        <div className="flex h-6 w-6 items-center justify-center text-civic-accent">
          <StreetIcon className="h-6 w-6" />
        </div>
        <span className="text-base font-semibold tracking-tight">
          Curbwise
        </span>
      </Link>

      {/* Desktop nav links */}
      <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/map'}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-civic-accent text-civic-ink'
                  : 'border-transparent text-civic-muted hover:text-civic-ink'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-1.5">
        {/* Account button */}
        <Link
          to="/account"
          className="hidden min-h-11 items-center gap-2 rounded px-3 text-sm font-medium text-civic-muted transition-colors hover:bg-civic-wash hover:text-civic-ink md:inline-flex"
        >
          <UserIcon className="w-4 h-4" />
          Account
        </Link>

        {/* Hamburger — mobile only */}
        <button
          ref={menuButton}
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-civic-line text-civic-ink transition-colors hover:bg-civic-wash md:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          aria-controls={menuId}
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          {mobileMenuOpen ? (
            <CloseIcon className="w-5 h-5" />
          ) : (
            <HamburgerIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <nav
          id={menuId}
          className="absolute left-0 right-0 top-full z-50 border-b border-civic-line bg-civic-paper md:hidden"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col p-3 gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/map'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-2.5 border-l-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-civic-accent text-civic-ink'
                      : 'border-transparent text-civic-muted hover:bg-civic-wash'
                  }`
                }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
            ))}
            <Link
              to="/account"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-12 items-center gap-2 rounded px-4 py-3 text-sm font-medium text-civic-muted hover:bg-civic-wash"
            >
              <UserIcon className="w-4 h-4" />
              Account
            </Link>
          </div>
        </nav>
      )}
    </header>
    </>
  );
}

// ── Navigation symbols ──────────────────────────────────────────────────

function StreetIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19L8 5" />
      <path d="M16 5L20 19" />
      <path d="M12 6V8" />
      <path d="M12 11V13" />
      <path d="M12 16V18" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PencilRulerIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21L12 12L21 3" />
      <path d="M15 6L18 3L21 6L18 9" />
      <path d="M3 15L6 12L9 15L6 18Z" />
    </svg>
  );
}

function ConcernIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H9l-5 4V4Z" />
      <path d="M12 7v4m0 2v.5" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
