import { NavLink } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspace-store';

const tabs = [
  { to: '/map', label: 'Map', icon: MapPinIcon, end: true },
  { to: '/hotspots', label: 'Observations', icon: ConcernIcon, end: false },
  { to: '/editor', label: 'Street concepts', icon: PencilRulerIcon, end: false },
  { to: '/account', label: 'Account', icon: UserIcon, end: false },
] as const;

interface BottomTabBarProps {
  className?: string;
}

export function BottomTabBar({ className = '' }: BottomTabBarProps) {
  const mode = useWorkspaceStore((s) => s.mode);

  // Hide tab bar when in design or configure mode (panels occupy bottom)
  if (mode !== 'explore') return null;

  return (
    <nav
      className={`safe-area-bottom flex shrink-0 items-stretch border-t border-civic-line bg-civic-paper ${className}`}
      aria-label="Tab navigation"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 px-1 py-2 text-center text-[11px] font-medium leading-4 transition-colors ${
              isActive
                ? 'border-civic-accent text-civic-ink'
                : 'border-transparent text-civic-muted hover:bg-civic-wash'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`h-5 w-5 ${isActive ? 'text-civic-ink' : 'text-civic-muted'}`} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PencilRulerIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21L12 12L21 3" />
      <path d="M15 6L18 3L21 6L18 9" />
      <path d="M3 15L6 12L9 15L6 18Z" />
    </svg>
  );
}

function ConcernIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H9l-5 4V4Z" />
      <path d="M12 7v4m0 2v.5" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
