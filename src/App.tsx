import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Layout } from '@/components/nav';
import { ToastProvider } from '@/components/ui/Toast';

// Lazy-load all pages for code splitting
const MapPage = lazy(() => import('@/pages/MapPage'));
const EditorPage = lazy(() => import('@/pages/EditorPage'));
const HotspotFeedPage = lazy(() => import('@/pages/HotspotFeedPage'));
const HotspotDetailPage = lazy(() => import('@/pages/HotspotDetailPage'));
const ReportPage = lazy(() => import('@/pages/ReportPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<Layout />}>
              {/* Map is the home / primary experience */}
              <Route path="/" element={<MapPage />} />

              {/* Editor — new street or load by ID */}
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/editor/:id" element={<EditorPage />} />

              {/* Hotspots — feed and detail */}
              <Route path="/hotspots" element={<HotspotFeedPage />} />
              <Route path="/hotspot/:id" element={<HotspotDetailPage />} />

              {/* Report builder — standalone or for a specific design */}
              <Route path="/report" element={<ReportPage />} />
              <Route path="/report/:designId" element={<ReportPage />} />

              {/* 404 catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
