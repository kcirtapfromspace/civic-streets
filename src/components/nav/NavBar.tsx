import { NavLink, Link } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';
import { useState } from 'react';

const navLinks = [
  { to: '/', label: 'Map', icon: MapPinIcon },
  { to: '/editor', label: 'Editor', icon: PencilRulerIcon },
  { to: '/hotspots', label: 'Hotspots', icon: FlameIcon },
] as const;

export function NavBar() {
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 shrink-0 z-50 relative">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2 mr-6 shrink-0">
        <StreetIcon className="w-6 h-6 text-blue-600" />
        <span className="font-semibold text-gray-900 text-sm hidden sm:inline">
          Street Copilot
        </span>
      </Link>

      {/* Desktop nav links */}
      <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Notification bell — placeholder */}
        <button
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Notifications"
          onClick={() => showToast('No new notifications', 'info')}
        >
          <BellIcon className="w-5 h-5" />
        </button>

        {/* Sign In button */}
        <button
          onClick={() => showToast('Sign-in coming soon!', 'info')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <UserIcon className="w-4 h-4" />
          Sign In
        </button>

        {/* Hamburger — mobile only */}
        <button
          className="md:hidden p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Toggle menu"
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
          className="absolute top-12 left-0 right-0 bg-white border-b border-gray-200 shadow-lg md:hidden z-50"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col p-2 gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            <button
              onClick={() => {
                showToast('Sign-in coming soon!', 'info');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              <UserIcon className="w-4 h-4" />
              Sign In
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────

function StreetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PencilRulerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21L12 12L21 3" />
      <path d="M15 6L18 3L21 6L18 9" />
      <path d="M3 15L6 12L9 15L6 18Z" />
    </svg>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
