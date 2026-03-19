'use client';

import React from 'react';
import type { ValidationResult, RenderMode } from '@/lib/types';
import { SEVERITY_COLORS } from '@/lib/constants';
import {
  PX_PER_FOOT,
  ELEMENT_Y_OFFSET,
  ELEMENT_RECT_HEIGHT,
  CURB_ELEVATION,
  ELEVATED_TYPES,
  FONT,
} from '../constants';

export interface ValidationOverlayProps {
  /** All validation results for a single element */
  validations: ValidationResult[];
  /** The element's width in feet */
  elementWidth: number;
  /** The element's type (to determine elevation) */
  elementType: string;
  /** Pixel X offset where this element starts */
  xOffset: number;
  /** Render mode */
  mode: RenderMode;
}

/**
 * Renders validation indicators over an element rectangle.
 * - Error: solid red border with glow
 * - Warning: orange dashed border
 * - Info: subtle blue indicator at bottom
 *
 * Also includes screen-reader-accessible text describing the validation issue.
 */
export const ValidationOverlay = React.memo(function ValidationOverlay({
  validations,
  elementWidth,
  elementType,
  xOffset,
  mode,
}: ValidationOverlayProps) {
  if (validations.length === 0) return null;

  const widthPx = elementWidth * PX_PER_FOOT;
  const isElevated = ELEVATED_TYPES.has(elementType);
  const yStart = isElevated ? ELEMENT_Y_OFFSET - CURB_ELEVATION : ELEMENT_Y_OFFSET;
  const rectHeight = isElevated
    ? ELEMENT_RECT_HEIGHT + CURB_ELEVATION
    : ELEMENT_RECT_HEIGHT;

  // Use the most severe validation result for the visual indicator
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  const sorted = [...validations].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
  const worst = sorted[0];
  const color = SEVERITY_COLORS[worst.severity];

  // Build the accessible description
  const description = validations
    .map(
      (v) =>
        `${v.severity}: ${v.message} (${v.citation})`,
    )
    .join('. ');

  return (
    <g aria-label={description} role="status">
      {/* Screen-reader accessible description */}
      <title>{description}</title>

      {worst.severity === 'error' && (
        <>
          {/* Red glow effect */}
          <rect
            x={xOffset - 2}
            y={yStart - 2}
            width={widthPx + 4}
            height={rectHeight + 4}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            opacity={0.5}
            rx={2}
            ry={2}
            pointerEvents="none"
          />
          {/* Solid red border */}
          <rect
            x={xOffset}
            y={yStart}
            width={widthPx}
            height={rectHeight}
            fill="none"
            stroke={color}
            strokeWidth={2}
            rx={0}
            ry={0}
            pointerEvents="none"
          />
        </>
      )}

      {worst.severity === 'warning' && (
        <rect
          x={xOffset}
          y={yStart}
          width={widthPx}
          height={rectHeight}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="6 3"
          rx={0}
          ry={0}
          pointerEvents="none"
        />
      )}

      {worst.severity === 'info' && (
        <>
          {/* Subtle blue bar at bottom */}
          <rect
            x={xOffset}
            y={yStart + rectHeight - 4}
            width={widthPx}
            height={4}
            fill={color}
            opacity={0.6}
            pointerEvents="none"
          />
        </>
      )}

      {/* Validation badge — small icon in top-right corner */}
      {widthPx > 24 && (
        <g pointerEvents="none">
          <circle
            cx={xOffset + widthPx - 10}
            cy={yStart + 10}
            r={7}
            fill={color}
            opacity={0.9}
          />
          <text
            x={xOffset + widthPx - 10}
            y={yStart + 10}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFFFFF"
            fontSize={9}
            fontFamily={FONT.family}
            fontWeight={700}
          >
            {worst.severity === 'error' ? '!' : worst.severity === 'warning' ? '!' : 'i'}
          </text>
        </g>
      )}

      {/* Tooltip text (visible in export mode, hidden by CSS hover in display) */}
      {mode === 'export' && widthPx > 60 && (
        <text
          x={xOffset + widthPx / 2}
          y={yStart + rectHeight + 36}
          textAnchor="middle"
          dominantBaseline="hanging"
          fill={color}
          fontSize={FONT.validationSize}
          fontFamily={FONT.family}
          fontWeight={500}
          pointerEvents="none"
        >
          {worst.message.length > 40
            ? worst.message.slice(0, 37) + '...'
            : worst.message}
        </text>
      )}
    </g>
  );
});

ValidationOverlay.displayName = 'ValidationOverlay';
