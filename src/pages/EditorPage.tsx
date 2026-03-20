import { Suspense, lazy, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStreetStore } from '@/stores/street-store';
import { useIntersectionStore } from '@/stores/intersection-store';
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

const IntersectionFlow = lazy(() =>
  import('@/features/intersection/IntersectionFlow').then((m) => ({ default: m.IntersectionFlow })),
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
  const [editorMode, setEditorMode] = useState<'street' | 'intersection'>('street');
  const intersectionStep = useIntersectionStore((s) => s.step);
  const intersectionName = useIntersectionStore((s) => s.intersectionName);

  // If we have an :id param but no street loaded yet, show loading state
  // (In Phase 1, this will fetch from Convex)
  if (id && !currentStreet) {
    return <LoadingDesign id={id} />;
  }

  // Street loaded — show editor
  if (currentStreet) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <EditorFeature />
        <TemplateGalleryModal />
      </Suspense>
    );
  }

  // No street loaded — show mode selector + form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Curbwise</h1>
          <p className="text-gray-500 mt-2">
            Design streets and improve intersections with safety data guidance.
          </p>
        </div>

        {/* Mode selector tabs */}
        <div className="flex items-center gap-1 bg-gray-200 rounded-xl p-1 mb-6">
          <button
            onClick={() => setEditorMode('street')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-lg transition-all duration-200 ${
              editorMode === 'street'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.157 2.175a1.5 1.5 0 00-1.147 0l-4.084 1.69A1.5 1.5 0 002 5.251v10.877a1.5 1.5 0 002.074 1.386l3.51-1.453 4.26 1.763a1.5 1.5 0 001.146 0l4.084-1.69A1.5 1.5 0 0018 14.748V3.873a1.5 1.5 0 00-2.074-1.386l-3.51 1.453-4.26-1.765z" clipRule="evenodd" />
            </svg>
            Street Design
          </button>
          <button
            onClick={() => setEditorMode('intersection')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-lg transition-all duration-200 ${
              editorMode === 'intersection'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Intersection
          </button>
        </div>

        <Suspense fallback={<LoadingSpinner />}>
          {editorMode === 'street' ? (
            <NewStreetForm />
          ) : (
            <IntersectionEditor />
          )}
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Inline intersection editor for the Editor tab.
 * Initializes a standalone intersection proposal and renders the wizard.
 */
function IntersectionEditor() {
  const step = useIntersectionStore((s) => s.step);
  const intersectionName = useIntersectionStore((s) => s.intersectionName);
  const initIntersection = useIntersectionStore((s) => s.initIntersection);
  const reset = useIntersectionStore((s) => s.reset);
  const [name, setName] = useState('');

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const label = name.trim() || 'Unnamed Intersection';
    // Use a default center (0,0) — in Editor tab there's no map click
    initIntersection(label, { lat: 0, lng: 0 }, { lat: 0, lng: 0, address: label });
  };

  // If intersection flow is active (already initialized), render the flow
  if (intersectionName) {
    return (
      <div className="relative">
        <Suspense fallback={<LoadingSpinner />}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.4)]" />
                <span className="text-[13px] font-bold text-gray-900 tracking-tight">
                  {intersectionName}
                </span>
              </div>
              <button
                onClick={reset}
                className="text-gray-300 hover:text-gray-500 transition-colors p-1.5 -mr-1.5 rounded-full hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Inline intersection steps */}
            <div className="p-5">
              {step === 'conditions' && (
                <Suspense fallback={null}>
                  <IntersectionConditionsSelector />
                </Suspense>
              )}
              {step === 'improvements' && (
                <Suspense fallback={null}>
                  <IntersectionImprovementPicker />
                </Suspense>
              )}
              {step === 'review' && (
                <Suspense fallback={null}>
                  <IntersectionReviewStep />
                </Suspense>
              )}
            </div>
          </div>
        </Suspense>
      </div>
    );
  }

  // Start form
  return (
    <form
      onSubmit={handleStart}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-gray-800">
        Intersection Improvement
      </h2>
      <p className="text-sm text-gray-500">
        Evaluate conditions and select crash-informed improvements for an intersection.
      </p>

      <div>
        <label
          htmlFor="intersection-name"
          className="text-sm font-medium text-gray-700 block mb-1"
        >
          Intersection Name
        </label>
        <input
          id="intersection-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Main St & Oak Ave"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
      >
        Start Intersection Review
      </button>
    </form>
  );
}

// Lazy step components for inline rendering
const IntersectionConditionsSelector = lazy(() =>
  import('@/features/intersection/steps/IntersectionConditionsSelector').then((m) => ({
    default: m.IntersectionConditionsSelector,
  })),
);
const IntersectionImprovementPicker = lazy(() =>
  import('@/features/intersection/steps/ImprovementPicker').then((m) => ({
    default: m.ImprovementPicker,
  })),
);
const IntersectionReviewStep = lazy(() =>
  import('@/features/intersection/steps/IntersectionReview').then((m) => ({
    default: m.IntersectionReview,
  })),
);

export default function EditorPage() {
  return (
    <ErrorBoundary>
      <EditorPageInner />
    </ErrorBoundary>
  );
}
