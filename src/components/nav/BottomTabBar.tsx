import { NavLink } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspace-store';

const tabs = [
  { to: '/map', label: 'Map', icon: MapPinIcon, end: true },
  { to: '/editor', label: 'Editor', icon: PencilRulerIcon, end: false },
  { to: '/hotspots', label: 'Hotspots', icon: FlameIcon, end: false },
  { to: '/profile', label: 'Profile', icon: UserIcon, end: false },
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
      className={`h-14 bg-white border-t border-gray-200 flex items-stretch z-50 shrink-0 ${className}`}
      aria-label="Tab navigation"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              isActive
                ? 'text-blue-600'
                : 'text-gray-500'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
