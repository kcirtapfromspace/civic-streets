import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Layout } from '@/components/nav';
import { ToastProvider } from '@/components/ui/Toast';
import { convexAvailable } from '@/lib/api/convex-provider';
import { useAuth } from '@/lib/api/auth';
import { identifyAnalytics } from '@/lib/analytics';

// Lazy-load all pages for code splitting
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const EditorPage = lazy(() => import('@/pages/EditorPage'));
const HotspotFeedPage = lazy(() => import('@/pages/HotspotFeedPage'));
const HotspotDetailPage = lazy(() => import('@/pages/HotspotDetailPage'));
const ReportPage = lazy(() => import('@/pages/ReportPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const BillingSuccessPage = lazy(() => import('@/pages/BillingSuccessPage'));
const BillingCancelPage = lazy(() => import('@/pages/BillingCancelPage'));
const InstitutionalDashboardPage = lazy(() => import('@/pages/InstitutionalDashboardPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

/** Bootstraps and identifies the browser's anonymous session inside ConvexProvider. */
function AuthBootstrap() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) identifyAnalytics(user?._id);
  }, [user?._id, isLoading]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        {convexAvailable && <AuthBootstrap />}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Marketing landing page — no nav chrome */}
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/pricing"
              element={<Navigate to={{ pathname: '/', hash: '#features' }} replace />}
            />
            <Route
              path="/institutions"
              element={<Navigate to={{ pathname: '/', hash: '#features' }} replace />}
            />

            {/* App pages — with nav layout */}
            <Route element={<Layout />}>
              <Route path="/map" element={<MapPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/editor/:id" element={<EditorPage />} />
              <Route path="/hotspots" element={<HotspotFeedPage />} />
              <Route path="/hotspot/:id" element={<HotspotDetailPage />} />

              {/* Billing */}
              <Route path="/account" element={<AccountPage />} />
              <Route path="/billing/success" element={<BillingSuccessPage />} />
              <Route path="/billing/cancel" element={<BillingCancelPage />} />

              {/* Institutional dashboard */}
              <Route path="/institutional/:orgSlug" element={<InstitutionalDashboardPage />} />

              {/* Report builder — standalone or for a specific design */}
              <Route path="/report" element={<ReportPage />} />
              <Route path="/report/:designId" element={<ReportPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
