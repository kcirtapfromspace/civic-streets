import { Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { useStreetStore } from '@/stores/street-store';
import { ErrorBoundary } from '@/components/ui';

// Lazy-load editor feature components
const EditorFeature = lazy(() =>
  import('@/features/editor').then((m) => ({ default: m.EditorPage })),
);

const NewStreetForm = lazy(() =>
  import('@/features/editor/NewStreetForm').then((m) => ({ default: m.NewStreetForm })),
);

const TemplateGalleryModal = lazy(() =>
  import('@/features/gallery').then((m) => ({ default: m.TemplateGalleryModal })),
);

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="text-gray-500 text-sm">Loading editor...</p>
      </div>
    </div>
  );
}

function LoadingDesign({ id }: { id: string }) {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="text-gray-500 text-sm">Loading design {id}...</p>
        <p className="text-gray-400 text-xs">
          Community designs will be fetched from Convex
        </p>
      </div>
    </div>
  );
}

function EditorPageInner() {
  const { id } = useParams<{ id: string }>();
  const currentStreet = useStreetStore((s) => s.currentStreet);

  // If we have an :id param but no street loaded yet, show loading state
  // (In Phase 1, this will fetch from Convex)
  if (id && !currentStreet) {
    return <LoadingDesign id={id} />;
  }

  // No street loaded and no id — show new street form
  if (!currentStreet) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <NewStreetForm />
      </Suspense>
    );
  }

  // Street loaded — show editor
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <EditorFeature />
      <TemplateGalleryModal />
    </Suspense>
  );
}

export default function EditorPage() {
  return (
    <ErrorBoundary>
      <EditorPageInner />
    </ErrorBoundary>
  );
}
