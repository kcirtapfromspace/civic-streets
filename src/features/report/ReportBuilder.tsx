// Report Builder — multi-step wizard for preparing email drafts to representatives
// Steps: 1. Context → 2. Find Reps → 3. Compose → 4. Review & Draft

import { findReportingArea } from '../../../shared/reporting-areas';
import { useMapStore } from '@/features/map/map-store';
import React, { useCallback, useMemo } from 'react';
import { Button, Badge } from '@/components/ui';
import { useReportStore, type ReportStep } from './report-store';
import { buildEmailDraftUrl } from './official-contacts';
import { RepLookup } from './RepLookup';
import { ReportSuccess } from './ReportSuccess';
import { generateReportSubject, generateReportBody } from './templates';
import type { ReportTemplateInput } from './templates';
import type { HotspotPin, DesignPin, DiscussionBriefContext, StreetSegment } from '@/lib/types';
import { HOTSPOT_CATEGORY_LABELS } from '@/lib/types';
import { BriefDownload } from './BriefDownload';
import { BriefPreview } from '@/features/export/BriefPreview';
import { captureAnalytics } from '@/lib/analytics';
import { convexAvailable } from '@/lib/api/convex-provider';

// ── Props ──────────────────────────────────────────────────────────────────

interface ReportBuilderProps {
  /** Pre-linked hotspot, if coming from a hotspot view */
  hotspot?: HotspotPin | null;
  /** Pre-linked design, if coming from a design view */
  design?: (DesignPin & { elements?: string; checksAvailable?: boolean }) | null;
  /** Pre-filled address from map/hotspot/design */
  initialAddress?: string;
  briefContext?: DiscussionBriefContext;
  street?: StreetSegment;
  beforeStreet?: StreetSegment | null;
  /** Called when the wizard is closed/dismissed */
  onClose?: () => void;
}

// ── Step labels ────────────────────────────────────────────────────────────

const STEP_LABELS: Record<ReportStep, string> = {
  1: 'Context',
  2: 'Find Your Reps',
  3: 'Compose Message',
  4: 'Review & Draft',
};

// ── Progress indicator ─────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: ReportStep }) {
  const steps = [1, 2, 3, 4] as ReportStep[];

  return (
    <nav aria-label="Report wizard progress" className="mb-6">
      <ol className="flex items-center gap-2">
        {steps.map((s) => {
          const isActive = s === currentStep;
          const isComplete = s < currentStep;

          return (
            <li key={s} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`
                    flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold flex-shrink-0 transition-colors
                    ${isComplete ? 'bg-civic-ink text-white' : ''}
                    ${isActive ? 'bg-civic-ink text-white ring-2 ring-civic-line' : ''}
                    ${!isActive && !isComplete ? 'bg-gray-200 text-civic-muted' : ''}
                  `}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isComplete ? (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                <span
                  className={`text-xs hidden sm:inline ${
                    isActive ? 'font-semibold text-gray-900' : 'text-civic-muted'
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {s < 4 && (
                <div
                  className={`h-px flex-1 ${
                    s < currentStep ? 'bg-civic-ink' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Step 1: Context ────────────────────────────────────────────────────────

function StepContext({
  hotspot,
  design,
}: {
  hotspot?: HotspotPin | null;
  design?: (DesignPin & { elements?: string; checksAvailable?: boolean }) | null;
}) {
  const { address, setContext, designId, hotspotId, setStep, messageInitialized } =
    useReportStore();

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContext(designId, hotspotId, e.target.value);
  };

  const handleUnlinkHotspot = () => {
    setContext(designId, null, address);
  };

  const handleUnlinkDesign = () => {
    setContext(null, hotspotId, address);
  };

  const canContinue = address.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          What are you reporting about?
        </h3>
        <p className="text-sm text-civic-muted">
          Optionally link a hotspot or street design to provide context for your
          message.
        </p>
      </div>

      {messageInitialized && <p className="text-sm text-civic-muted">Changing linked context keeps your message edits. Review any source references in the message before sending.</p>}
      {/* Hotspot link */}
      {hotspot && (
        <div
          className={`rounded-lg border p-3 ${
            hotspotId ? 'border-civic-line bg-civic-wash' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={hotspotId ? 'info' : 'default'}
              >
                Hotspot
              </Badge>
              <span className="text-sm font-medium text-gray-800">
                {hotspot.title}
              </span>
              <span className="text-xs text-civic-muted">
                {HOTSPOT_CATEGORY_LABELS[hotspot.category]}
              </span>
            </div>
            {hotspotId ? (
              <Button variant="ghost" onClick={handleUnlinkHotspot}>
                Remove
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setContext(designId, hotspot.id, address)}>
                Link
              </Button>
            )}
          </div>
          {hotspotId && convexAvailable && (
            <p className="text-xs text-gray-600 mt-1">
              {hotspot.upvotes} upvote{hotspot.upvotes === 1 ? '' : 's'} from
              community members
            </p>
          )}
        </div>
      )}

      {/* Design link */}
      {design && (
        <div
          className={`rounded-lg border p-3 ${
            designId ? 'border-civic-line bg-civic-wash' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={designId ? 'info' : 'default'}
              >
                Design
              </Badge>
              <span className="text-sm font-medium text-gray-800">
                {design.title}
              </span>
              <Badge variant={design.prowagPass ? 'success' : 'warning'}>
                {design.checksAvailable === false ? 'Checks not supplied' : design.prowagPass ? 'No flags in selected checks' : 'Selected checks need review'}
              </Badge>
            </div>
            {designId ? (
              <Button variant="ghost" onClick={handleUnlinkDesign}>
                Remove
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setContext(design.id, hotspotId, address)}>
                Link
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Address */}
      <div>
        <label
          htmlFor="report-address"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Address
        </label>
        <input
          id="report-address"
          type="text"
          value={address}
          onChange={handleAddressChange}
          placeholder="Enter the street address..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-ink"
        />
      </div>

      {/* Next */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => setStep(2)}
          disabled={!canContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Find Reps ──────────────────────────────────────────────────────

function StepFindReps() {
  const { address, selectedReps, selectRep, deselectRep, setStep } =
    useReportStore();

  const canContinue = selectedReps.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Find Your Representatives
        </h3>
        <p className="text-sm text-civic-muted">
          Select one or more representatives to contact.
        </p>
      </div>

      <RepLookup
        initialAddress={address}
        selectedReps={selectedReps}
        onSelectRep={selectRep}
        onDeselectRep={deselectRep}
      />

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => setStep(3)}
          disabled={!canContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Compose ────────────────────────────────────────────────────────

function StepCompose({
  hotspot,
  design,
}: {
  hotspot?: HotspotPin | null;
  design?: (DesignPin & { elements?: string; checksAvailable?: boolean }) | null;
}) {
  const {
    address,
    selectedReps,
    hotspotId,
    designId,
    subject,
    body,
    setSubject,
    setBody,
    setStep,
    briefContext,
    messageInitialized,
    initializeMessage,
  } = useReportStore();
  // Auto-generate template on first render if body is empty
  const generated = useMemo(() => {
    const firstRep = selectedReps[0];
    if (!firstRep) return { subject: '', body: '' };

    const input: ReportTemplateInput = {
      repName: firstRep.name,
      address,
    };

    if (hotspotId && hotspot) {
      input.hotspotTitle = hotspot.title;
      input.hotspotCategory = hotspot.category;
      input.hotspotDescription = briefContext?.observation?.description;
      if (convexAvailable) {
        input.hotspotVotes = hotspot.upvotes;
        input.communityVotes = hotspot.upvotes;
      }
    }

    if (designId && design) {
      input.designTitle = design.title;
      input.designElements = design.elements;
      if (design.checksAvailable !== false) input.prowagCompliant = design.prowagPass;
      if (convexAvailable && design.upvotes) {
        input.communityVotes = Math.max(
          input.communityVotes ?? 0,
          design.upvotes,
        );
      }
    }

    if (briefContext && (!briefContext.observation || hotspotId === briefContext.observation.id)) {
      input.concern = briefContext.concern;
      input.desiredOutcome = briefContext.desiredOutcome;
      input.requestedNextStep = briefContext.requestedNextStep;
      if (briefContext.observation?.source === 'community') input.sourceUrl = briefContext.sourceUrl;
    }
    return {
      subject: generateReportSubject(input),
      body: generateReportBody(input),
    };
  }, [address, selectedReps, hotspotId, hotspot, designId, design, briefContext]);

  // Initialize once. A deliberately erased field must stay erased.
  React.useEffect(() => {
    if (!messageInitialized && generated.body) initializeMessage(generated.subject, generated.body);
  }, [generated, messageInitialized, initializeMessage]);

  const charCount = body.length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Compose Your Message
        </h3>
        <p className="text-sm text-civic-muted">
          Review and personalize the pre-drafted message below.
        </p>
      </div>

      {/* Subject */}
      <div>
        <label
          htmlFor="report-subject"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Subject
        </label>
        <input
          id="report-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-ink"
        />
      </div>

      {/* Body */}
      <div>
        <label
          htmlFor="report-body"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Message
        </label>
        <textarea
          id="report-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-ink resize-y font-mono leading-relaxed"
        />
        <p className="text-xs text-civic-muted mt-1 text-right">
          {charCount.toLocaleString()} characters
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => setStep(4)}
          disabled={!subject.trim() || !body.trim()}
        >
          Review
        </Button>
      </div>
    </div>
  );
}

// ── Step 4: Review & Send ──────────────────────────────────────────────────

function StepReview({ onSent, street, beforeStreet }: { onSent: () => void; street?: StreetSegment; beforeStreet?: StreetSegment | null }) {
  const {
    selectedReps,
    subject,
    body,
    designId,
    hotspotId,
    setStep,
  } = useReportStore();

  const briefContext = useReportStore((state) => state.briefContext);
  const attachedContext = useMemo(() => briefContext?.observation && briefContext.observation.id !== hotspotId
    ? { ...briefContext, observation: undefined, sourceUrl: undefined } : briefContext, [briefContext, hotspotId]);
  const attachedStreet = designId ? street : undefined;
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const mailtoUrl = buildEmailDraftUrl(selectedReps, subject, body);
  const handleSendEmail = () => {
    if (!mailtoUrl) return;
    captureAnalytics('report_email_draft_opened', {
      recipient_count: selectedReps.length,
      includes_pdf: false,
    });
    window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
    onSent();
  };

  const handleCopyToClipboard = async () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyStatus('Message copied. Nothing has been sent.');
    } catch {
      setCopyStatus('Copying failed. Select the message below and copy it manually; your draft is unchanged.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Review Your Message
        </h3>
        <p className="text-sm text-civic-muted">
          Double-check the recipients and message. You will send it yourself in your email app.
        </p>
      </div>

      {/* Recipients */}
      <div>
        <h4 className="text-xs font-semibold text-civic-muted uppercase tracking-wide mb-2">
          Recipients
        </h4>
        <div className="flex flex-wrap gap-2">
          {selectedReps.map((rep) => (
            <div
              key={rep.name}
              className="flex items-center gap-2 rounded-full bg-civic-wash border border-civic-line px-3 py-1"
            >
              <span className="text-sm font-medium text-civic-ink">
                {rep.name}
              </span>
              {rep.email && (
                <span className="text-xs text-civic-muted">{rep.email}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <BriefDownload key={JSON.stringify([attachedContext, attachedStreet, beforeStreet])} context={attachedContext} street={attachedStreet} beforeStreet={beforeStreet} />
      {attachedContext && <details><summary className="min-h-11 cursor-pointer py-3">Read the discussion brief</summary><BriefPreview context={attachedContext} /></details>}
      {copyStatus && <p role="status" className="text-sm text-civic-muted">{copyStatus}</p>}

      {/* Message preview */}
      <div>
        <h4 className="text-xs font-semibold text-civic-muted uppercase tracking-wide mb-2">
          Message Preview
        </h4>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            {subject}
          </p>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
            {body}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button variant="secondary" onClick={() => setStep(3)}>
          Back
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" onClick={handleCopyToClipboard}>
          <svg
            className="w-4 h-4 mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy to Clipboard
        </Button>
        <Button variant="primary" onClick={handleSendEmail} disabled={!mailtoUrl}>
          <svg
            className="w-4 h-4 mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          Open Email Draft
        </Button>
      </div>
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export function ReportBuilder({
  hotspot,
  design,
  initialAddress = '',
  briefContext,
  street,
  beforeStreet,
  onClose,
}: ReportBuilderProps) {
  const { step, address, selectedReps, openContext, reset, saveError } =
    useReportStore();
  const [sent, setSent] = React.useState(false);
  const [contextReady, setContextReady] = React.useState(false);
  const selectedLocation = useMapStore((state) => state.selectedLocation);
  const location = hotspot ?? design ?? selectedLocation;
  const reportingAllowed = Boolean(location && findReportingArea(location.lat, location.lng));

  // Route context gets its own saved recipient draft; never reuse another concern's text.
  React.useEffect(() => {
    openContext(design?.id ?? null, hotspot?.id ?? null, initialAddress, briefContext);
    setContextReady(true);
    // Context is established once for this route. Later text edits remain authoritative.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSent = useCallback(() => {
    setSent(true);
  }, []);

  const handleReportAnother = useCallback(() => {
    reset();
    setSent(false);
  }, [reset]);

  // Success view
  if (sent && reportingAllowed) {
    return (
      <div className="max-w-2xl mx-auto">
        <ReportSuccess
          reps={selectedReps}
          address={address}
          onReportAnother={handleReportAnother}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Share with Your Representatives
        </h2>
        {onClose && (
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        )}
      </div>

      {!reportingAllowed && (
        <p role="alert" className="mb-4 text-sm text-amber-800">
          Reporting tools are available in Chicago, Denver, and New York City.
          {' '}<a href="/map" className="underline">Choose a location on the map</a> to continue.
        </p>
      )}
      <p role="status" className="mb-4 text-xs text-civic-muted">{saveError || 'Your recipient draft is saved in this browser. Nothing is sent automatically.'}</p>
      {/* Progress */}
      <StepIndicator currentStep={step} />

      {/* Step content */}
      <fieldset disabled={!reportingAllowed} className="bg-white rounded-lg border border-gray-200 p-6">
        {contextReady && step === 1 && <StepContext hotspot={hotspot} design={design} />}
        {contextReady && reportingAllowed && step === 2 && <StepFindReps />}
        {contextReady && reportingAllowed && step === 3 && <StepCompose hotspot={hotspot} design={design} />}
        {contextReady && reportingAllowed && step === 4 && <StepReview onSent={handleSent} street={street} beforeStreet={beforeStreet} />}
      </fieldset>
    </div>
  );
}
