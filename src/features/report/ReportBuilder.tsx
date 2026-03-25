// Report Builder — multi-step wizard for composing and sending reports to reps
// Steps: 1. Context → 2. Find Reps → 3. Compose → 4. Review & Send

import React, { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge } from '@/components/ui';
import { useReportStore, type ReportStep } from './report-store';
import { RepLookup } from './RepLookup';
import { ReportSuccess } from './ReportSuccess';
import { generateReportSubject, generateReportBody } from './templates';
import type { ReportTemplateInput } from './templates';
import type { HotspotPin, DesignPin } from '@/lib/types';
import { HOTSPOT_CATEGORY_LABELS } from '@/lib/types';
import { getGovernmentContactHref, useBillingAccess } from '@/lib/billing/access';

// ── Props ──────────────────────────────────────────────────────────────────

interface ReportBuilderProps {
  /** Pre-linked hotspot, if coming from a hotspot view */
  hotspot?: HotspotPin | null;
  /** Pre-linked design, if coming from a design view */
  design?: (DesignPin & { elements?: string }) | null;
  /** Pre-filled address from map/hotspot/design */
  initialAddress?: string;
  /** Called when the wizard is closed/dismissed */
  onClose?: () => void;
}

// ── Step labels ────────────────────────────────────────────────────────────

const STEP_LABELS: Record<ReportStep, string> = {
  1: 'Context',
  2: 'Find Your Reps',
  3: 'Compose Message',
  4: 'Review & Send',
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
                    ${isComplete ? 'bg-blue-600 text-white' : ''}
                    ${isActive ? 'bg-blue-600 text-white ring-2 ring-blue-200' : ''}
                    ${!isActive && !isComplete ? 'bg-gray-200 text-gray-500' : ''}
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
                    isActive ? 'font-semibold text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {s < 4 && (
                <div
                  className={`h-px flex-1 ${
                    s < currentStep ? 'bg-blue-600' : 'bg-gray-200'
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
  design?: (DesignPin & { elements?: string }) | null;
}) {
  const { address, setContext, designId, hotspotId, setStep } =
    useReportStore();

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContext(designId, hotspotId, e.target.value);
  };

  const handleLinkHotspot = () => {
    if (hotspot) {
      setContext(designId, hotspot.id, address);
    }
  };

  const handleUnlinkHotspot = () => {
    setContext(designId, null, address);
  };

  const handleLinkDesign = () => {
    if (design) {
      setContext(design.id, hotspotId, address);
    }
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
        <p className="text-sm text-gray-500">
          Optionally link a hotspot or street design to provide context for your
          message.
        </p>
      </div>

      {/* Hotspot link */}
      {hotspot && (
        <div
          className={`rounded-lg border p-3 ${
            hotspotId ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
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
              <span className="text-xs text-gray-500">
                {HOTSPOT_CATEGORY_LABELS[hotspot.category]}
              </span>
            </div>
            {hotspotId ? (
              <Button variant="ghost" onClick={handleUnlinkHotspot}>
                Remove
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleLinkHotspot}>
                Link
              </Button>
            )}
          </div>
          {hotspotId && (
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
            designId ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
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
                {design.prowagPass ? 'PROWAG Pass' : 'PROWAG Issues'}
              </Badge>
            </div>
            {designId ? (
              <Button variant="ghost" onClick={handleUnlinkDesign}>
                Remove
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleLinkDesign}>
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
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
        <p className="text-sm text-gray-500">
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
  design?: (DesignPin & { elements?: string }) | null;
}) {
  const navigate = useNavigate();
  const {
    address,
    selectedReps,
    hotspotId,
    designId,
    subject,
    body,
    includePdf,
    setSubject,
    setBody,
    togglePdf,
    setStep,
  } = useReportStore();
  const { canAccess: canAttachPdf, contactHref } = useBillingAccess(
    'report_pdf_attachment',
  );

  const handleUpgrade = useCallback(() => {
    navigate(contactHref || getGovernmentContactHref('report_pdf_attachment'));
  }, [contactHref, navigate]);

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
      input.hotspotVotes = hotspot.upvotes;
      input.communityVotes = hotspot.upvotes;
    }

    if (designId && design) {
      input.designTitle = design.title;
      input.designElements = design.elements;
      input.prowagCompliant = design.prowagPass;
      if (design.upvotes) {
        input.communityVotes = Math.max(
          input.communityVotes ?? 0,
          design.upvotes,
        );
      }
    }

    return {
      subject: generateReportSubject(input),
      body: generateReportBody(input),
    };
  }, [address, selectedReps, hotspotId, hotspot, designId, design]);

  // Populate fields if empty
  React.useEffect(() => {
    if (!subject && generated.subject) {
      setSubject(generated.subject);
    }
    if (!body && generated.body) {
      setBody(generated.body);
    }
  }, [generated, subject, body, setSubject, setBody]);

  useEffect(() => {
    if (designId && includePdf && !canAttachPdf) {
      togglePdf();
    }
  }, [designId, includePdf, canAttachPdf, togglePdf]);

  const charCount = body.length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Compose Your Message
        </h3>
        <p className="text-sm text-gray-500">
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
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-y font-mono leading-relaxed"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {charCount.toLocaleString()} characters
        </p>
      </div>

      {/* PDF attachment toggle */}
      {designId && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includePdf}
              onChange={() => {
                if (canAttachPdf) {
                  togglePdf();
                } else {
                  handleUpgrade();
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={!canAttachPdf}
            />
            <span className="text-sm text-gray-700">
              Include Street Design PDF
            </span>
            {!canAttachPdf && (
              <Badge variant="warning">Gov</Badge>
            )}
          </label>
          {!canAttachPdf && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                PDF attachments are enabled once your jurisdiction is provisioned.
              </p>
              <Button variant="ghost" onClick={handleUpgrade}>
                Contact Curbwise
              </Button>
            </div>
          )}
        </div>
      )}

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

function StepReview({ onSent }: { onSent: () => void }) {
  const {
    selectedReps,
    subject,
    body,
    includePdf,
    setStep,
  } = useReportStore();

  const handleSendEmail = () => {
    const toAddresses = selectedReps
      .filter((r) => r.email)
      .map((r) => r.email!)
      .join(',');

    const mailtoUrl = `mailto:${toAddresses}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    onSent();
  };

  const handleCopyToClipboard = async () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      // Clipboard API may fail in some contexts
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Review Your Message
        </h3>
        <p className="text-sm text-gray-500">
          Double-check everything before sending.
        </p>
      </div>

      {/* Recipients */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Recipients
        </h4>
        <div className="flex flex-wrap gap-2">
          {selectedReps.map((rep) => (
            <div
              key={rep.name}
              className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1"
            >
              <span className="text-sm font-medium text-blue-800">
                {rep.name}
              </span>
              {rep.email && (
                <span className="text-xs text-blue-600">{rep.email}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Attachments */}
      {includePdf && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Attachments
          </h4>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            Street Design PDF
          </div>
        </div>
      )}

      {/* Message preview */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
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
        <Button variant="primary" onClick={handleSendEmail}>
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
          Send via Email
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
  onClose,
}: ReportBuilderProps) {
  const { step, address, selectedReps, setContext, designId, hotspotId, reset } =
    useReportStore();
  const [sent, setSent] = React.useState(false);

  // Initialize address from props on mount
  React.useEffect(() => {
    if (initialAddress && !address) {
      setContext(
        design?.id ?? null,
        hotspot?.id ?? null,
        initialAddress,
      );
    }
    // Auto-link design/hotspot if provided
    if (design && !designId) {
      setContext(design.id, hotspotId, address || initialAddress);
    }
    if (hotspot && !hotspotId) {
      setContext(designId, hotspot.id, address || initialAddress);
    }
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
  if (sent) {
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

      {/* Progress */}
      <StepIndicator currentStep={step} />

      {/* Step content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {step === 1 && <StepContext hotspot={hotspot} design={design} />}
        {step === 2 && <StepFindReps />}
        {step === 3 && <StepCompose hotspot={hotspot} design={design} />}
        {step === 4 && <StepReview onSent={handleSent} />}
      </div>
    </div>
  );
}
