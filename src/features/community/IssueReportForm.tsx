import React, { useState, useCallback, useEffect, useRef, useId, useMemo } from 'react';
import { ConvexError } from 'convex/values';
import { captureAnalytics } from '@/lib/analytics';
import { convexAvailable } from '@/lib/api/convex-provider';
import { usePhotoRequirement } from '@/lib/api/use-report-eligibility';
import { useStartProposal } from '@/features/proposal/useStartProposal';
import { useProposalStore } from '@/stores/proposal-store';
import type { IssueGroup, IssueType, HotspotSeverity } from '@/lib/types/community';
import { ISSUE_GROUP_LABELS, ISSUE_GROUP_COLORS, SEVERITY_LABELS } from '@/lib/types/community';
import { getIssueTypesByGroup, getIssueTypeConfig, ISSUE_GROUP_ICONS } from '@/lib/config/issue-types';
import { processImages, type ProcessedImage } from '../../lib/images/process-image';
import { MAX_PHOTO_BYTES, MAX_REPORT_PHOTOS, PHOTO_CONTENT_TYPE } from '../../../shared/photo-upload';

import { ReportAssistance } from './ReportAssistance';
import type { Id } from '../../../convex/_generated/dataModel';

import { findReportingArea } from '../../../shared/reporting-areas';

const MAX_SOURCE_PHOTO_BYTES = 10 * 1024 * 1024;
const SOURCE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ── Severity colors ───────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<HotspotSeverity, string> = {
  low: '#6B7280',
  medium: '#CA8A04',
  high: '#EA580C',
  critical: '#DC2626',
};

const SEVERITY_ORDER: HotspotSeverity[] = ['low', 'medium', 'high', 'critical'];

function bumpSeverity(severity: HotspotSeverity): HotspotSeverity {
  const idx = SEVERITY_ORDER.indexOf(severity);
  return SEVERITY_ORDER[Math.min(idx + 1, SEVERITY_ORDER.length - 1)];
}

// ── Form output ───────────────────────────────────────────────────────────

export interface IssueReportFormData {
  reportAssistanceId?: Id<'reportAssistance'>;
  location: { lat: number; lng: number; address: string };
  group: IssueGroup;
  issueType: IssueType;
  photoDataUrls: string[];
  severity: HotspotSeverity;
  isBlocking: boolean;
  title: string;
  description: string;
  processedImages?: ProcessedImage[];
  honeypotValue?: string;
  formOpenedAt?: number;
}

interface IssueReportFormProps {
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  onSubmit: (data: IssueReportFormData) => void | Promise<void>;
  onCancel?: () => void;
}

// ── Groups (static) ───────────────────────────────────────────────────────

const ALL_GROUPS: IssueGroup[] = [
  'road-surface', 'sidewalk', 'signal-sign', 'bike',
  'obstruction', 'safety', 'transit', 'other',
];

// ── Component ─────────────────────────────────────────────────────────────

export function IssueReportForm({
  initialAddress = '',
  initialLat = 0,
  initialLng = 0,
  onSubmit,
  onCancel,
}: IssueReportFormProps) {
  const photoRequirement = usePhotoRequirement();
  const { startProposal, confirmation } = useStartProposal();
  // Step navigation
  const [step, setStep] = useState(1);

  // Step 1: Photo + location
  const [photoDataUrls, setPhotoDataUrls] = useState<string[]>([]);
  const [address, setAddress] = useState(initialAddress);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Category
  const [selectedGroup, setSelectedGroup] = useState<IssueGroup | null>(null);
  const [selectedType, setSelectedType] = useState<IssueType | null>(null);
  const [severity, setSeverity] = useState<HotspotSeverity>('medium');
  const [severityOverridden, setSeverityOverridden] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showSeverityPicker, setShowSeverityPicker] = useState(false);

  // Step 3: Details
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [description, setDescription] = useState('');
  const assistanceId = useRef<Id<'reportAssistance'> | undefined>(undefined);

  // Anti-abuse: honeypot + timing
  const [honeypotValue, setHoneypotValue] = useState('');
  const [formOpenedAt] = useState(() => Date.now());

  // Image processing pipeline
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const processingImagesRef = useRef(false);
  const previewUrlsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    const previewUrls = previewUrlsRef.current;
    return () => {
      mountedRef.current = false;
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const addressId = useId();
  const titleId = useId();
  const descId = useId();

  // Subtypes for selected group
  const subtypes = useMemo(
    () => (selectedGroup ? getIssueTypesByGroup(selectedGroup) : []),
    [selectedGroup],
  );

  // Auto-generated title
  const autoTitle = useMemo(() => {
    if (!selectedType) return '';
    const config = getIssueTypeConfig(selectedType);
    if (!config) return '';
    const shortAddr = address.split(',')[0].trim() || 'this location';
    return `${config.label} near ${shortAddr}`;
  }, [selectedType, address]);

  // When type changes, update auto-title and severity
  const handleTypeSelect = useCallback(
    (slug: IssueType) => {
      setSelectedType(slug);
      const config = getIssueTypeConfig(slug);
      if (config && !severityOverridden) {
        const sev = isBlocking ? bumpSeverity(config.defaultSeverity) : config.defaultSeverity;
        setSeverity(sev);
      }
    },
    [isBlocking, severityOverridden],
  );

  // When blocking toggle changes
  const handleBlockingToggle = useCallback(() => {
    setIsBlocking((prev) => {
      const next = !prev;
      if (!severityOverridden && selectedType) {
        const config = getIssueTypeConfig(selectedType);
        if (config) {
          setSeverity(next ? bumpSeverity(config.defaultSeverity) : config.defaultSeverity);
        }
      }
      return next;
    });
  }, [severityOverridden, selectedType]);

  // ── Photo handling ──────────────────────────────────────────────────

  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (processingImagesRef.current) return;
    const imageFiles = Array.from(files);
    if (imageFiles.length === 0) return;
    if (processedImages.length + imageFiles.length > MAX_REPORT_PHOTOS) {
      setPhotoError('A report can include up to three photos. Remove a photo before adding another.');
      return;
    }
    if (imageFiles.some((file) => !SOURCE_PHOTO_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_SOURCE_PHOTO_BYTES)) {
      setPhotoError('Choose JPEG, PNG, or WebP photos up to 10 MiB each.');
      return;
    }

    processingImagesRef.current = true;
    setIsProcessingImages(true);
    setPhotoError(null);
    try {
      const results = await processImages(imageFiles);
      if (!mountedRef.current) return;
      if (results.some(({ blob }) => blob.size === 0 || blob.size > MAX_PHOTO_BYTES || blob.type !== PHOTO_CONTENT_TYPE)) {
        throw new Error('Prepared photo exceeds upload limits');
      }
      setProcessedImages((prev) => [...prev, ...results]);
      // Also create preview URLs for display
      const previewUrls = results.map((r) => URL.createObjectURL(r.blob));
      previewUrls.forEach((url) => previewUrlsRef.current.add(url));
      setPhotoDataUrls((prev) => [...prev, ...previewUrls]);
    } catch {
      setPhotoError('A photo could not be prepared. Please try adding it again.');
    } finally {
      processingImagesRef.current = false;
      setIsProcessingImages(false);
    }
  }, [processedImages.length]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    },
    [processFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
    },
    [processFiles],
  );

  const removePhoto = useCallback((index: number) => {
    const url = photoDataUrls[index];
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(url);
    }
    setPhotoDataUrls((prev) => prev.filter((_, i) => i !== index));
    setProcessedImages((prev) => prev.filter((_, i) => i !== index));
  }, [photoDataUrls]);

  // ── Navigation ──────────────────────────────────────────────────────

  const reportingAllowed = Boolean(findReportingArea(initialLat, initialLng));
  const photosReady = photoRequirement === 'optional' || (photoRequirement === 'required' && processedImages.length > 0);
  const canAdvanceStep1 = reportingAllowed && address.trim().length > 0 && photosReady;
  const canAdvanceStep2 = selectedGroup !== null && selectedType !== null;

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, 3)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  // ── Submit ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reportingAllowed || !photosReady || !selectedGroup || !selectedType || !address.trim() || isProcessingImages || submittingRef.current) return;

      submittingRef.current = true;
      setIsSubmitting(true);
      setSubmissionError(null);
      const finalTitle = (titleEdited && title.trim()) ? title.trim() : autoTitle;
      try {
        await onSubmit({
          reportAssistanceId: assistanceId.current,
          location: { lat: initialLat, lng: initialLng, address: address.trim() },
          group: selectedGroup,
          issueType: selectedType,
          photoDataUrls,
          severity,
          isBlocking,
          title: finalTitle,
          description: description.trim(),
          processedImages,
          honeypotValue,
          formOpenedAt,
        });
        captureAnalytics('issue_report_submitted', {
          issue_group: selectedGroup,
          issue_type: selectedType,
          severity,
          is_blocking: isBlocking,
          photo_count: photoDataUrls.length,
        });
      } catch (error) {
        setSubmissionError(reportErrorMessage(error));
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [reportingAllowed, photosReady, selectedGroup, selectedType, titleEdited, title, autoTitle, address, initialLat, initialLng, photoDataUrls, severity, isBlocking, description, onSubmit, processedImages, honeypotValue, formOpenedAt, isProcessingImages],
  );

  // ── Step indicator ──────────────────────────────────────────────────

  const stepLabels = ['Location & photo', 'What did you notice?', 'More details'];

  return (
    <>
    {confirmation}
    <form
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
      className="mx-auto w-full max-w-lg bg-white text-civic-ink"
    >
      <fieldset disabled={isSubmitting} className="min-w-0">
      {!reportingAllowed && (
        <p role="alert" className="px-5 pt-4 text-sm text-amber-800">
          You can search anywhere in the US. To save an observation, choose a map location in Chicago, Denver, or New York City.
        </p>
      )}
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {stepLabels[step - 1]}
          </h2>
          <span className="text-xs text-gray-400">
            {step === 3 ? 'Optional' : `Step ${step} of 2`}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {convexAvailable
            ? 'Save the location, what you noticed, and photos to the public map. Capture is currently available in the Chicago, Denver, and New York City pilot areas.'
            : 'Demo mode: your observation stays in this browser session and disappears on reload. It is not published.'}
        </p>
        {/* Step dots */}
        <div className="flex gap-1.5 mt-2">
          {stepLabels.slice(0, 2).map((label, i) => (
            <div
              key={label}
              className={`h-1 rounded-full flex-1 transition-colors ${
                i + 1 <= step ? 'bg-civic-ink' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Honeypot fields - invisible to users, bots will fill them */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypotValue}
          onChange={(e) => setHoneypotValue(e.target.value)}
        />
      </div>

      <div className="px-5 py-4">
        {/* ── STEP 1: Photo + Location ──────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Photo upload — prominent */}
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Upload photos by clicking or dragging"
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-civic-ink bg-civic-wash'
                    : photoDataUrls.length > 0
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`mb-2 ${photoDataUrls.length > 0 ? 'text-green-500' : 'text-gray-400'}`}
                  aria-hidden="true"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  {photoDataUrls.length > 0
                    ? `${photoDataUrls.length} photo${photoDataUrls.length > 1 ? 's' : ''} added`
                    : 'Take a photo of the problem'}
                </span>
                <span className="text-xs text-gray-600 mt-0.5">
                  {photoRequirement === 'required' ? 'At least one photo is required for your public observation.' : photoRequirement === 'loading' ? 'Checking the photo requirement for your reporting session…' : photoRequirement === 'unavailable' ? 'Your reporting session is unavailable. You can keep a private concern below.' : 'Photos are optional for this observation.'}
                </span>
                <span className="text-xs text-gray-600 mt-0.5">Up to 3 photos &middot; JPEG, PNG, or WebP &middot; 10 MiB each</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                multiple
                onChange={handleFileInput}
                className="hidden"
                aria-hidden="true"
              />

              {/* Photo thumbnails */}
              {photoDataUrls.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {photoDataUrls.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded overflow-hidden border border-gray-200">
                      <img src={url} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                        aria-label={`Remove photo ${i + 1}`}
                        className="absolute top-0 right-0 bg-black/60 text-white w-4 h-4 flex items-center justify-center text-xs leading-none rounded-bl"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isProcessingImages && (
                <p className="text-xs text-gray-500 mt-1">Compressing photos...</p>
              )}
              {photoError && <p role="alert" className="text-xs text-red-700 mt-2">{photoError}</p>}
            </div>

            {/* Location */}
            <div>
              <label
                htmlFor={addressId}
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Location
              </label>
              <input
                id={addressId}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Oak St & 5th Ave, Portland, OR"
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-ink"
              />
              {address && (
                <p className="text-xs text-gray-400 mt-1">The pin sets the location. You can edit its address label.</p>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: What's wrong? ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label htmlFor={descId} className="block text-xs font-medium text-gray-600 mb-1">Describe what you noticed (optional)</label>
              <textarea id={descId} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000}
                placeholder="For example, a parked car blocks the curb ramp every morning…" rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-ink resize-none" />
            </div>
            {/* Group tiles — 2×4 grid */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">
                What type of problem?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {ALL_GROUPS.map((group) => {
                  const isSelected = selectedGroup === group;
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => {
                        setSelectedGroup(group);
                        setSelectedType(group === 'other' ? 'other' : null);
                        if (!severityOverridden) setSeverity('medium');
                      }}
                      aria-pressed={isSelected}
                      className={`flex min-h-16 flex-col items-center gap-1 p-2.5 rounded border text-center transition-colors ${
                        isSelected
                          ? 'border-civic-ink bg-civic-wash ring-1 ring-civic-ink'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isSelected ? ISSUE_GROUP_COLORS[group] : '#9CA3AF'}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d={ISSUE_GROUP_ICONS[group]} />
                      </svg>
                      <span className={`text-[10px] leading-tight ${
                        isSelected ? 'text-civic-ink font-medium' : 'text-gray-600'
                      }`}>
                        {ISSUE_GROUP_LABELS[group]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtype pills */}
            {selectedGroup && subtypes.length > 1 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Specific issue
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {subtypes.map((t) => {
                    const isSelected = selectedType === t.slug;
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => handleTypeSelect(t.slug)}
                        aria-pressed={isSelected}
                        className={`min-h-11 px-3 py-1.5 text-xs rounded border transition-colors ${
                          isSelected
                            ? 'border-civic-ink bg-civic-wash text-civic-ink font-medium'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <details className="text-xs text-civic-muted">
              <summary className="min-h-11 cursor-pointer py-3">Help choosing a category</summary>
            <ReportAssistance
              key={JSON.stringify([description, initialLat, initialLng])}
              input={{ description, lat: initialLat, lng: initialLng }}
              onResult={(id) => { assistanceId.current = id; }}
              onApply={(issueType) => {
                const config = getIssueTypeConfig(issueType)!;
                setSelectedGroup(config.group);
                handleTypeSelect(config.slug);
              }}
            />
            </details>

            {/* Severity badge + blocking toggle */}
            {selectedType && (
              <div className="flex items-center gap-3">
                {/* Severity badge — tappable */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSeverityPicker((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: SEVERITY_COLORS[severity] }}
                    />
                    <span style={{ color: SEVERITY_COLORS[severity] }} className="font-medium">
                      {SEVERITY_LABELS[severity]}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" className="text-gray-400">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Severity dropdown */}
                  {showSeverityPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                      {SEVERITY_ORDER.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSeverity(s);
                            setSeverityOverridden(true);
                            setShowSeverityPicker(false);
                          }}
                          className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-gray-50 ${
                            severity === s ? 'font-medium' : ''
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: SEVERITY_COLORS[s] }}
                          />
                          {SEVERITY_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Blocking toggle */}
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isBlocking}
                    onClick={handleBlockingToggle}
                    className={`relative w-8 h-[18px] rounded-full transition-colors ${
                      isBlocking ? 'bg-orange-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                        isBlocking ? 'translate-x-[14px]' : ''
                      }`}
                    />
                  </button>
                  Blocking passage?
                </label>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Details (optional) ────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor={titleId}
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Title
              </label>
              <input
                id={titleId}
                type="text"
                value={titleEdited ? title : autoTitle}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleEdited(true);
                }}
                placeholder="Auto-generated — edit if you'd like"
                maxLength={120}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-ink"
              />
              {!titleEdited && autoTitle && (
                <p className="text-xs text-gray-400 mt-1">Auto-generated from your selection</p>
              )}
            </div>

            <div>
              <label
                htmlFor={descId}
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Any details that would help? (optional)
              </label>
              <textarea
                id={descId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What you noticed, when it happened, how it affects you..."
                rows={3}
                maxLength={5000}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-ink resize-none"
              />
            </div>

            {/* Summary card */}
            {selectedGroup && selectedType && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ISSUE_GROUP_COLORS[selectedGroup] }}
                  />
                  <span className="text-xs font-medium text-gray-700">
                    {ISSUE_GROUP_LABELS[selectedGroup]}
                  </span>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-xs text-gray-600">
                    {getIssueTypeConfig(selectedType)?.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: SEVERITY_COLORS[severity] }}
                  />
                  <span className="text-xs" style={{ color: SEVERITY_COLORS[severity] }}>
                    {SEVERITY_LABELS[severity]}
                  </span>
                  {isBlocking && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                      Blocking
                    </span>
                  )}
                </div>
                {photoDataUrls.length > 0 && (
                  <p className="text-xs text-gray-400">
                    {photoDataUrls.length} photo{photoDataUrls.length > 1 ? 's' : ''} attached
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {submissionError && (
        <div role="alert" className="mx-5 mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          <p>{submissionError}</p>
          <p className="mt-1">Your draft is still here. Review it and try again.</p>
        </div>
      )}

      {/* Capture is complete after selecting an issue; extra details are optional. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-civic-line px-5 py-4">
        <div>
          {step > 1 && (
            <button type="button" onClick={goBack} className="min-h-11 rounded px-3 text-sm text-civic-muted hover:bg-civic-wash disabled:opacity-50">
              Back
            </button>
          )}
          {step === 1 && onCancel && (
            <button type="button" onClick={onCancel} className="min-h-11 rounded px-3 text-sm text-civic-muted hover:bg-civic-wash disabled:opacity-50">
              Cancel
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {step === 1 && (
            <button
              type="button"
              disabled={isProcessingImages || !canAdvanceStep1}
              onClick={goNext}
              className="min-h-11 rounded bg-civic-ink px-4 text-sm font-medium text-white hover:bg-black disabled:opacity-40"
            >
              Next
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={isProcessingImages || !canAdvanceStep2}
              onClick={goNext}
              className="min-h-11 rounded px-3 text-sm text-civic-muted hover:bg-civic-wash disabled:opacity-40"
            >
              Add details
            </button>
          )}
          {step === 3 && onCancel && (
            <button type="button" onClick={onCancel} className="min-h-11 rounded px-3 text-sm text-civic-muted hover:bg-civic-wash disabled:opacity-50">
              Cancel
            </button>
          )}
          {step > 1 && (
            <button
              type="submit"
              disabled={isSubmitting || isProcessingImages || !canAdvanceStep2 || !photosReady}
              className="min-h-11 rounded bg-civic-ink px-4 text-sm font-medium text-white hover:bg-black disabled:opacity-40"
            >
              {isSubmitting ? 'Saving...' : 'Save observation'}
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-civic-line px-5 py-3 text-xs leading-5 text-civic-muted">
        <p>Prefer to keep notes for yourself? A private concern does not require a photo or public posting.</p>
        <button type="button" disabled={!address.trim()} className="min-h-11 underline disabled:opacity-50" onClick={() => startProposal({
          streetName: title.trim() || address.trim(),
          location: { lat: initialLat, lng: initialLng, address: address.trim() },
          onStarted: () => {
            useProposalStore.getState().setBriefContext({ concern: description.trim() || (selectedType ? autoTitle : '') });
            onCancel?.();
          },
        })}>Keep as a private concern</button>
        {photoDataUrls.length > 0 && <p>Photos selected for the public observation are not copied to the private concern.</p>}
      </div>
      </fieldset>
    </form>
    </>
  );
}

function reportErrorMessage(error: unknown): string {
  const fallback = 'Your observation could not be saved. Please try again.';
  if (error instanceof ConvexError) {
    return typeof error.data === 'string' && error.data.trim() ? error.data : fallback;
  }
  if (!(error instanceof Error) || error.message.startsWith('[CONVEX')) return fallback;
  return error.message.split('\n')[0] || 'Your observation could not be saved. Please try again.';
}
