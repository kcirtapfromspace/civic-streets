import { useState, useEffect, ComponentType } from 'react';
import { useParams, Link } from 'react-router-dom';

interface ReportBuilderProps {
  designId?: string;
}

function ReportPlaceholder({ designId }: ReportBuilderProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-purple-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Report Builder</h1>
        <p className="text-gray-500">
          {designId
            ? `Generate a report for design ${designId}. Coming soon!`
            : 'Generate PDF reports for your street designs. Coming soon!'}
        </p>
        <Link
          to="/editor"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          &larr; Go to Editor
        </Link>
      </div>
    </div>
  );
}

function useDynamicComponent<P extends object>(
  loader: () => Promise<Record<string, unknown>>,
  namedExport: string | null,
  Fallback: ComponentType<P>,
): ComponentType<P> {
  const [Component, setComponent] = useState<ComponentType<P>>(() => Fallback);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((mod) => {
        if (cancelled) return;
        const resolved =
          namedExport && namedExport in mod
            ? (mod[namedExport] as ComponentType<P>)
            : (mod.default as ComponentType<P>);
        if (resolved) setComponent(() => resolved);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return Component;
}

export default function ReportPage() {
  const { designId } = useParams<{ designId: string }>();

  const ReportBuilder = useDynamicComponent<ReportBuilderProps>(
    () => import('@/features/report/ReportBuilder'),
    'ReportBuilder',
    ReportPlaceholder,
  );

  return (
    <div className="h-full overflow-y-auto">
      <ReportBuilder designId={designId} />
    </div>
  );
}
