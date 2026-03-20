
import React from 'react';
import type { CrossSectionElement, ValidationResult } from '@/lib/types';
import { ELEMENT_COLORS, UNITS } from '@/lib/constants';
import { Tooltip } from '@/components/ui';

interface ElementRowProps {
  element: CrossSectionElement;
  index: number;
  totalCount: number;
  isSelected: boolean;
  validations: ValidationResult[];
  onSelect: () => void;
  onUpdateWidth: (width: number) => void;
  onToggleLock: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function ElementRow({
  element,
  index,
  totalCount,
  isSelected,
  validations,
  onSelect,
  onUpdateWidth,
  onToggleLock,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ElementRowProps) {
  const color = ELEMENT_COLORS[element.type];
  const hasError = validations.some((v) => v.severity === 'error');
  const hasWarning = validations.some((v) => v.severity === 'warning');

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value);
    if (!isNaN(raw) && raw >= 0) {
      onUpdateWidth(parseFloat(raw.toFixed(2)));
    }
  };

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${element.label || color.label}, ${element.width} ${UNITS.primary} wide${hasError ? ', has errors' : hasWarning ? ', has warnings' : ''}`}
      className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-50 ring-2 ring-blue-500'
          : 'hover:bg-gray-50'
      }`}
    >
      {/* Color indicator */}
      <span
        className="w-3 h-3 rounded-sm shrink-0 border"
        style={{ backgroundColor: color.fill, borderColor: color.stroke }}
        aria-hidden="true"
      />

      {/* Label */}
      <span className="text-sm font-medium text-gray-800 truncate min-w-0 flex-1">
        {element.label || color.label}
      </span>

      {/* Validation indicator */}
      {(hasError || hasWarning) && (
        <Tooltip
          content={
            hasError
              ? `${validations.filter((v) => v.severity === 'error').length} error(s)`
              : `${validations.filter((v) => v.severity === 'warning').length} warning(s)`
          }
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              hasError ? 'bg-red-500' : 'bg-amber-500'
            }`}
            aria-label={hasError ? 'Has errors' : 'Has warnings'}
          />
        </Tooltip>
      )}

      {/* Width input */}
      <label className="sr-only" htmlFor={`width-${element.id}`}>
        Width for {element.label || color.label}
      </label>
      <input
        id={`width-${element.id}`}
        type="number"
        value={element.width}
        onChange={handleWidthChange}
        step={0.5}
        min={element.constraints.absoluteMin}
        max={element.constraints.absoluteMax}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-14 px-1 py-0.5 text-sm text-right border border-gray-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={`Width of ${element.label || color.label} in feet`}
      />
      <span className="text-xs text-gray-500 shrink-0">{UNITS.primary}</span>

      {/* Lock toggle */}
      <Tooltip content={element.locked ? 'Unlock width' : 'Lock width'}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
          aria-label={
            element.locked
              ? `Unlock ${element.label || color.label}`
              : `Lock ${element.label || color.label}`
          }
          className="p-1 text-gray-400 rounded hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {element.locked ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M11 5V4a3 3 0 00-6 0v1H4a1 1 0 00-1 1v7a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-4-1a2 2 0 114 0v1H7V4z" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M11 5h1a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1h5V4a2 2 0 10-4 0v1H4V4a3 3 0 116 0v1z" />
            </svg>
          )}
        </button>
      </Tooltip>

      {/* Move buttons */}
      <div className="flex flex-col shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={index === 0}
          aria-label={`Move ${element.label || color.label} up`}
          className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 3L2 7h8L6 3z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={index === totalCount - 1}
          aria-label={`Move ${element.label || color.label} down`}
          className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 9l4-4H2l4 4z" />
          </svg>
        </button>
      </div>

      {/* Delete button */}
      <Tooltip content="Remove element">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${element.label || color.label}`}
          className="p-1 text-gray-400 rounded hover:text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm-7-1A.5.5 0 014 4h8a.5.5 0 010 1H4a.5.5 0 01-.5-.5zM6 2.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zM3 5h10l-.867 9.286A1 1 0 0111.14 15H4.86a1 1 0 01-.993-.714L3 5z" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}
