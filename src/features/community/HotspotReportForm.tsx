import React, { useState, useCallback, useRef, useId } from 'react';
import { Button, Select } from '@/components/ui';
import type { HotspotCategory, HotspotSeverity, AccessibilitySubtype } from '@/lib/types/community';
import { HOTSPOT_CATEGORY_LABELS, SEVERITY_LABELS, ACCESSIBILITY_SUBTYPE_LABELS } from '@/lib/types/community';

// ── Severity colors ───────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<HotspotSeverity, string> = {
  low: '#6B7280',
  medium: '#CA8A04',
  high: '#EA580C',
  critical: '#DC2626',
};

// ── Form state ────────────────────────────────────────────────────────────

interface ReportFormData {
  address: string;
  category: HotspotCategory;
  severity: HotspotSeverity;
  accessibilitySubtype?: AccessibilitySubtype;
  title: string;
  description: string;
  photoDataUrls: string[];
}

interface HotspotReportFormProps {
  /** Pre-filled address from map pin */
  initialAddress?: string;
  onSubmit?: (data: ReportFormData) => void;
  onCancel?: () => void;
}

// ── Category options for Select ───────────────────────────────────────────

const categoryOptions = Object.entries(HOTSPOT_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const accessibilitySubtypeOptions = Object.entries(ACCESSIBILITY_SUBTYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

// ── Component ─────────────────────────────────────────────────────────────

export function HotspotReportForm({
  initialAddress = '',
  onSubmit,
  onCancel,
}: HotspotReportFormProps) {
  const [address, setAddress] = useState(initialAddress);
  const [category, setCategory] = useState<HotspotCategory>('dangerous-intersection');
  const [accessibilitySubtype, setAccessibilitySubtype] = useState<AccessibilitySubtype | ''>('');
  const [severity, setSeverity] = useState<HotspotSeverity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoDataUrls, setPhotoDataUrls] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();
  const addressId = useId();

  // ── Photo handling ────────────────────────────────────────────────────

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      f.type.startsWith('image/'),
    );

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setPhotoDataUrls((prev) => [...prev, dataUrl]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles],
  );

  const removePhoto = useCallback((index: number) => {
    setPhotoDataUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !address.trim()) return;

      setIsSubmitting(true);
      onSubmit?.({
        address: address.trim(),
        category,
        severity,
        accessibilitySubtype: category === 'accessibility' && accessibilitySubtype ? accessibilitySubtype : undefined,
        title: title.trim(),
        description: description.trim(),
        photoDataUrls,
      });
      setIsSubmitting(false);
    },
    [address, category, severity, accessibilitySubtype, title, description, photoDataUrls, onSubmit],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-auto"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Report a Street Issue
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Help improve your neighborhood — takes about 30 seconds.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
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
        </div>

        {/* Category */}
        <Select
          label="Category"
          value={category}
          onChange={(v) => {
            setCategory(v as HotspotCategory);
            if (v !== 'accessibility') setAccessibilitySubtype('');
          }}
          options={categoryOptions}
        />

        {/* Accessibility subtype picker */}
        {category === 'accessibility' && (
          <Select
            label="Accessibility Issue Type"
            value={accessibilitySubtype}
            onChange={(v) => setAccessibilitySubtype(v as AccessibilitySubtype)}
            options={[
              { value: '', label: 'Select specific issue...' },
              ...accessibilitySubtypeOptions,
            ]}
          />
        )}

        {/* Severity */}
        <fieldset>
          <legend className="text-xs font-medium text-gray-600 mb-2">
            Severity
          </legend>
          <div className="flex gap-2">
            {(
              Object.entries(SEVERITY_LABELS) as [HotspotSeverity, string][]
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border cursor-pointer transition-colors ${
                  severity === value
                    ? 'border-current bg-gray-50 font-medium'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                style={{
                  color: severity === value ? SEVERITY_COLORS[value] : undefined,
                }}
              >
                <input
                  type="radio"
                  name="severity"
                  value={value}
                  checked={severity === value}
                  onChange={() => setSeverity(value)}
                  className="sr-only"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: SEVERITY_COLORS[value] }}
                  aria-hidden="true"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Title */}
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "No crosswalk at Oak & 5th"'
            required
            maxLength={120}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor={descId}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Description
          </label>
          <textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes this location dangerous or problematic? Any details help."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
          />
        </div>

        {/* Photo Upload */}
        <div>
          <span className="block text-xs font-medium text-gray-600 mb-1">
            Photos (optional)
          </span>

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
            className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400 mb-1"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs text-gray-500">
              Drag photos here or click to browse
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
                  <img
                    src={url}
                    alt={`Upload ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute top-0 right-0 bg-black/60 text-white w-4 h-4 flex items-center justify-center text-xs leading-none rounded-bl"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200 flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Report This Hotspot'}
        </Button>
      </div>
    </form>
  );
}
