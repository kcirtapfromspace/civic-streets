import { useEffect, useState } from 'react';
import { Badge, Button, Modal } from '@/components/ui';
import { useUnsignedOutreach } from '@/lib/api/government';
import type { JurisdictionSummary } from '@/lib/types/government';
import type { MockHotspot } from '@/features/community/mock-data';

interface UnsignedJurisdictionOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotspot: MockHotspot;
  jurisdiction: JurisdictionSummary | null;
  sourceAction: 'report_to_city' | 'send_to_rep';
}

export function UnsignedJurisdictionOutreachModal({
  isOpen,
  onClose,
  hotspot,
  jurisdiction,
  sourceAction,
}: UnsignedJurisdictionOutreachModalProps) {
  const { queueUnsignedOutreach, isSubmitting } = useUnsignedOutreach();
  const [result, setResult] = useState<{
    status: string;
    message: string;
    draft?: {
      subject: string;
      summary: string;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setResult(null);
    setError(null);
  }, [
    isOpen,
    sourceAction,
    hotspot.id,
    hotspot.title,
    hotspot.address,
    hotspot.lat,
    hotspot.lng,
    hotspot.category,
    hotspot.upvotes,
  ]);

  const handleQueue = async () => {
    setError(null);
    try {
      const response = await queueUnsignedOutreach({
        sourceAction,
        hotspot: {
          id: hotspot.id,
          title: hotspot.title,
          description: hotspot.description,
          address: hotspot.address,
          lat: hotspot.lat,
          lng: hotspot.lng,
          category: hotspot.category,
          upvotes: hotspot.upvotes,
        },
      });

      setResult({
        status: typeof response?.status === 'string' ? response.status : 'queued_review',
        message:
          typeof response?.message === 'string'
            ? response.message
            : 'Queued for Curbwise outreach review.',
        draft:
          response &&
          typeof response === 'object' &&
          'draft' in response &&
          response.draft &&
          typeof response.draft === 'object'
            ? {
                subject:
                  typeof response.draft.subject === 'string'
                    ? response.draft.subject
                    : 'Government outreach draft',
                summary:
                  typeof response.draft.summary === 'string'
                    ? response.draft.summary
                    : '',
              }
            : undefined,
      });
    } catch (queueError) {
      setError(
        queueError instanceof Error
          ? queueError.message
          : 'Unable to queue outreach right now.',
      );
    }
  };

  const title =
    sourceAction === 'report_to_city'
      ? 'Route this to Curbwise outreach'
      : 'Ask Curbwise to reach the right office';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={jurisdiction?.isSigned ? 'success' : 'warning'}>
              {jurisdiction?.isSigned ? 'Signed' : 'Unsigned jurisdiction'}
            </Badge>
            {jurisdiction?.displayName && (
              <span className="text-sm font-medium text-slate-700">
                {jurisdiction.displayName}
              </span>
            )}
          </div>
          <p className="text-sm leading-6 text-slate-600">
            This jurisdiction is not live on Curbwise yet, so we will queue an
            internal outreach request instead of dropping you into a dead-end
            city or representative flow.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Hotspot
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            {hotspot.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{hotspot.address}</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {hotspot.description}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Official contacts
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {jurisdiction?.freshContactCount
                  ? `Using ${jurisdiction.freshContactCount} fresh official contact${jurisdiction.freshContactCount === 1 ? '' : 's'}.`
                  : 'If we do not have fresh contacts yet, this request stays queued while we collect them from official public directories.'}
              </p>
            </div>
            <Badge variant="info">
              {jurisdiction?.contactCount ?? 0} cached
            </Badge>
          </div>

          {jurisdiction?.topContacts && jurisdiction.topContacts.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {jurisdiction.topContacts.slice(0, 4).map((contact) => (
                <div
                  key={contact.contactId}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <p className="text-sm font-medium text-slate-900">
                    {contact.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {contact.name}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    {contact.email ?? contact.phone ?? 'No public email listed yet'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {result ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Queued</Badge>
              <span>{result.message}</span>
            </div>
            {result.draft && (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-white/70 p-3 text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Draft
                </p>
                <p className="mt-2 text-sm font-medium">{result.draft.subject}</p>
                {result.draft.summary && (
                  <p className="mt-1 text-sm">{result.draft.summary}</p>
                )}
              </div>
            )}
          </div>
        ) : null}

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {!result && (
            <Button variant="primary" onClick={() => void handleQueue()} disabled={isSubmitting}>
              {isSubmitting ? 'Queuing outreach...' : 'Queue Curbwise outreach'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
