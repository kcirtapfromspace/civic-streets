import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Layout } from '@/components/nav';
import { ToastProvider } from '@/components/ui/Toast';
import { convexAvailable } from '@/lib/api/convex-provider';
import { useAuth } from '@/lib/api/auth';

// Lazy-load all pages for code splitting
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const EditorPage = lazy(() => import('@/pages/EditorPage'));
const HotspotFeedPage = lazy(() => import('@/pages/HotspotFeedPage'));
const HotspotDetailPage = lazy(() => import('@/pages/HotspotDetailPage'));
const ReportPage = lazy(() => import('@/pages/ReportPage'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const BillingSuccessPage = lazy(() => import('@/pages/BillingSuccessPage'));
const BillingCancelPage = lazy(() => import('@/pages/BillingCancelPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

/** Bootstraps anonymous session when Convex is available. Must be inside ConvexProvider. */
function AuthBootstrap() {
  useAuth(); // creates anonymous user + stores session token on first visit
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

            {/* App pages — with nav layout */}
            <Route element={<Layout />}>
              <Route path="/map" element={<MapPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/editor/:id" element={<EditorPage />} />
              <Route path="/hotspots" element={<HotspotFeedPage />} />
              <Route path="/hotspot/:id" element={<HotspotDetailPage />} />

              {/* Billing */}
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/billing/success" element={<BillingSuccessPage />} />
              <Route path="/billing/cancel" element={<BillingCancelPage />} />

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
