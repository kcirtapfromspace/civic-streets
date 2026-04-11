import React, { useState, useCallback, useRef, useId, useMemo } from 'react';
import { Button } from '@/components/ui';
import type { IssueGroup, IssueType, HotspotSeverity } from '@/lib/types/community';
import { ISSUE_GROUP_LABELS, ISSUE_GROUP_COLORS, SEVERITY_LABELS } from '@/lib/types/community';
import { ISSUE_TYPES, getIssueTypesByGroup, getIssueTypeConfig, ISSUE_GROUP_ICONS } from '@/lib/config/issue-types';
import { processImages, type ProcessedImage, type PhotoExifData } from '../../lib/images/process-image';

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
  onSubmit?: (data: IssueReportFormData) => void;
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

  // Anti-abuse: honeypot + timing
  const [honeypotValue, setHoneypotValue] = useState('');
  const [formOpenedAt] = useState(() => Date.now());

  // Image processing pipeline
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
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
    const shortAddr = address.split(',')[0] || 'this location';
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
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsProcessingImages(true);
    try {
      const results = await processImages(imageFiles);
      setProcessedImages((prev) => [...prev, ...results]);
      // Also create preview URLs for display
      const previewUrls = results.map((r) => URL.createObjectURL(r.blob));
      setPhotoDataUrls((prev) => [...prev, ...previewUrls]);
    } finally {
      setIsProcessingImages(false);
    }
  }, []);

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
    setPhotoDataUrls((prev) => prev.filter((_, i) => i !== index));
    setProcessedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────

  const canAdvanceStep1 = address.trim().length > 0;
  const canAdvanceStep2 = selectedGroup !== null && selectedType !== null;

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, 3)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  // ── Submit ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedGroup || !selectedType) return;

      setIsSubmitting(true);
      const finalTitle = (titleEdited && title.trim()) ? title.trim() : autoTitle;
      onSubmit?.({
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
      setIsSubmitting(false);
    },
    [selectedGroup, selectedType, titleEdited, title, autoTitle, address, initialLat, initialLng, photoDataUrls, severity, isBlocking, description, onSubmit, processedImages, honeypotValue, formOpenedAt],
  );

  // ── Step indicator ──────────────────────────────────────────────────

  const stepLabels = ['Photo & Location', "What's Wrong?", 'Details'];

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-auto"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Report a Problem
          </h2>
          <span className="text-xs text-gray-400">
            Step {step} of 3
          </span>
        </div>
        {/* Step dots */}
        <div className="flex gap-1.5 mt-2">
          {stepLabels.map((label, i) => (
            <div
              key={label}
              className={`h-1 rounded-full flex-1 transition-colors ${
                i + 1 <= step ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          {stepLabels[step - 1]}
        </p>
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
                    ? 'border-blue-400 bg-blue-50'
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
                <span className="text-xs text-gray-400 mt-0.5">
                  Tap to take photo or upload &middot; Photo recommended
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              {address && (
                <p className="text-xs text-gray-400 mt-1">Pre-filled from map — edit if needed</p>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: What's wrong? ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
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
                        setSelectedType(null);
                        if (!severityOverridden) setSeverity('medium');
                      }}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
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
                        isSelected ? 'text-blue-700 font-medium' : 'text-gray-600'
                      }`}>
                        {ISSUE_GROUP_LABELS[group]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtype pills */}
            {selectedGroup && subtypes.length > 0 && (
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
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-100 text-blue-700 font-medium'
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
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
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

      {/* Footer navigation */}
      <div className="px-5 py-4 border-t border-gray-200 flex gap-2 justify-between">
        <div>
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={goBack}>
              Back
            </Button>
          )}
          {step === 1 && onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {step < 3 && (
            <Button
              type="button"
              variant="primary"
              disabled={step === 1 ? !canAdvanceStep1 : !canAdvanceStep2}
              onClick={goNext}
            >
              Next
            </Button>
          )}
          {step === 3 && (
            <>
              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={isSubmitting || !canAdvanceStep2}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </>
          )}
          {/* Skip to submit from step 2 */}
          {step === 2 && canAdvanceStep2 && (
            <Button
              type="submit"
              variant="ghost"
              disabled={isSubmitting}
              className="text-xs"
            >
              Skip details & submit
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
