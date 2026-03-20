import { Outlet, useLocation } from 'react-router-dom';
import { NavBar } from './NavBar';
import { BottomTabBar } from './BottomTabBar';

export function Layout() {
  const location = useLocation();

  // Map page is full-viewport — no extra bottom padding for the tab bar
  const isMapPage = location.pathname === '/';

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <main className={`flex-1 min-h-0 ${isMapPage ? '' : 'pb-14 lg:pb-0'}`}>
        <Outlet />
      </main>
      <BottomTabBar className={`lg:hidden fixed bottom-0 left-0 right-0 ${isMapPage ? '' : ''}`} />
    </div>
  );
}
