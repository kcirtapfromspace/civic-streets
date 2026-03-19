'use client';

import React from 'react';
import { useStreetStore } from '@/stores/street-store';
import { ELEMENT_COLORS } from '@/lib/constants';
import type { ValidationResult, ConstraintType } from '@/lib/types';

function groupByConstraint(
  results: ValidationResult[],
): Record<ConstraintType, ValidationResult[]> {
  const groups: Record<ConstraintType, ValidationResult[]> = {
    prowag: [],
    nacto: [],
    dimensional: [],
  };
  for (const r of results) {
    groups[r.constraint].push(r);
  }
  return groups;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'error') {
    return (
      <span className="text-red-500 shrink-0" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.5 3h1v5h-1V4zm0 6h1v1h-1v-1z" />
        </svg>
      </span>
    );
  }
  if (severity === 'warning') {
    return (
      <span className="text-amber-500 shrink-0" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7.134 1.5a1 1 0 011.732 0l6.063 10.5A1 1 0 0114.063 13H1.937a1 1 0 01-.866-1.5L7.134 1.5zM7.5 5v4h1V5h-1zm0 5v1h1v-1h-1z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="text-blue-500 shrink-0" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.5 3h1v1h-1V4zm0 2h1v6h-1V6z" />
      </svg>
    </span>
  );
}

function ValidationItem({ result }: { result: ValidationResult }) {
  const selectElement = useStreetStore((s) => s.selectElement);
  const currentStreet = useStreetStore((s) => s.currentStreet);

  const element = currentStreet?.elements.find(
    (el) => el.id === result.elementId,
  );
  const label =
    result.elementId === '__street__'
      ? 'Street'
      : element
        ? element.label || ELEMENT_COLORS[element.type].label
        : result.elementId;

  const isClickable = result.elementId !== '__street__';

  return (
    <button
      onClick={() => {
        if (isClickable) selectElement(result.elementId);
      }}
      disabled={!isClickable}
      aria-label={`${result.severity}: ${label} — ${result.message}`}
      className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        isClickable
          ? 'hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer'
          : 'cursor-default'
      }`}
    >
      <SeverityIcon severity={result.severity} />
      <span className="sr-only">{result.severity}:</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-600 mt-0.5">{result.message}</div>
        <div className="text-xs text-gray-500 mt-0.5 italic">
          {result.citation}
        </div>
      </div>
    </button>
  );
}

function ConstraintSection({
  title,
  results,
}: {
  title: string;
  results: ValidationResult[];
}) {
  if (results.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-1">
        {title}
      </h3>
      <div className="space-y-0.5">
        {results.map((r, i) => (
          <ValidationItem key={`${r.elementId}-${r.constraint}-${i}`} result={r} />
        ))}
      </div>
    </div>
  );
}

export function ValidationPanel() {
  const validationResults = useStreetStore((s) => s.validationResults);

  const errorCount = validationResults.filter(
    (r) => r.severity === 'error',
  ).length;
  const warningCount = validationResults.filter(
    (r) => r.severity === 'warning',
  ).length;
  const infoCount = validationResults.filter(
    (r) => r.severity === 'info',
  ).length;

  const groups = groupByConstraint(validationResults);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">
          Validation Results
        </h2>
      </div>

      {/* Summary */}
      <div
        className="px-4 py-2 border-b border-gray-200"
        aria-live="polite"
        aria-atomic="true"
      >
        {validationResults.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.354 4.646l-4 4a.5.5 0 01-.708 0l-2-2a.5.5 0 11.708-.708L7 8.586l3.646-3.647a.5.5 0 01.708.708z" />
            </svg>
            <span>All standards met</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            {infoCount > 0 && (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                {infoCount} info
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        <ConstraintSection title="PROWAG" results={groups.prowag} />
        <ConstraintSection title="NACTO" results={groups.nacto} />
        <ConstraintSection title="Dimensional" results={groups.dimensional} />
      </div>
    </div>
  );
}
