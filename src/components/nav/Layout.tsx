import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { NavBar } from './NavBar';
import { BottomTabBar } from './BottomTabBar';
import { convexAvailable } from '@/lib/api/convex-provider';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';

export function Layout() {
  useEffect(() => {
    const protectUnsavedWork = (event: BeforeUnloadEvent) => {
      if (!Object.keys(useWorkDraftsStore.getState().pending).length) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectUnsavedWork);
    return () => window.removeEventListener('beforeunload', protectUnsavedWork);
  }, []);
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-civic-paper text-civic-ink">
      <NavBar />
      {!convexAvailable && (
        <aside aria-label="Demo mode" className="shrink-0 border-b border-civic-line bg-civic-wash px-4 py-2 text-sm text-civic-muted">
          <strong>Demo mode.</strong> Example reports and activity are fictional. Demo observations disappear on reload; private drafts in My work stay in this browser. Nothing is published or submitted to a city.
        </aside>
      )}
      <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
      <BottomTabBar className="md:hidden" />
    </div>
  );
}
