import { NavLink, Link } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';
import { useState } from 'react';

const navLinks = [
  { to: '/map', label: 'Map', icon: MapPinIcon },
  { to: '/editor', label: 'Editor', icon: PencilRulerIcon },
  { to: '/hotspots', label: 'Hotspots', icon: FlameIcon },
  { to: '/pricing', label: 'Pricing', icon: TagIcon },
] as const;

export function NavBar() {
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="h-14 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center px-5 shrink-0 z-50 relative">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2.5 mr-8 shrink-0 group">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_1px_3px_rgba(37,99,235,0.3)]">
          <StreetIcon className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-sm tracking-tight hidden sm:inline">
          Curbwise
        </span>
      </Link>

      {/* Desktop nav links */}
      <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/map'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 ease-spring ${
                isActive
                  ? 'bg-blue-600 text-white shadow-[0_1px_3px_rgba(37,99,235,0.3)]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/80'
              }`
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-1.5">
        {/* Notification bell */}
        <button
          className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 transition-all duration-300 ease-spring"
          aria-label="Notifications"
          onClick={() => showToast('No new notifications', 'info')}
        >
          <BellIcon className="w-[18px] h-[18px]" />
        </button>

        {/* Account button */}
        <Link
          to="/account"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <UserIcon className="w-4 h-4" />
          Account
        </Link>

        {/* Hamburger — mobile only */}
        <button
          className="md:hidden p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 transition-all duration-300 ease-spring"
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
          className="absolute top-14 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.08)] md:hidden z-50 animate-fade-up"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col p-3 gap-1">
            {navLinks.map(({ to, label, icon: Icon }, i) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/map'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-spring animate-fade-up stagger-${i + 1} ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-[0_1px_3px_rgba(37,99,235,0.3)]'
                      : 'text-gray-600 hover:bg-gray-100/80'
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
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              <UserIcon className="w-4 h-4" />
              Account
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

// ── Inline SVG Icons (thin stroke, premium feel) ──────────────────────────

function StreetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PencilRulerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21L12 12L21 3" />
      <path d="M15 6L18 3L21 6L18 9" />
      <path d="M3 15L6 12L9 15L6 18Z" />
    </svg>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
